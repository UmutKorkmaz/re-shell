import { BackendTemplate } from '../types';

/**
 * API Gateway Template
 * API gateway integration with Kong, Ambassador, and Istio Gateway
 */
export const apiGatewayTemplate: BackendTemplate = {
  id: 'api-gateway',
  name: 'API Gateway',
  displayName: 'API Gateway Integration',
  description: 'Complete API gateway integration with Kong, Ambassador, and Istio Gateway including rate limiting, authentication, transformations, and routing',
  version: '1.0.0',
  language: 'typescript',
  framework: 'kubernetes',
  tags: ['kubernetes', 'gateway', 'kong', 'ambassador', 'istio', 'api-gateway'],
  port: 8080,
  dependencies: {},
  features: ['security', 'monitoring', 'documentation'],

  files: {
    'kong/kong.yaml': `# Kong Gateway Configuration
# API gateway with plugins for authentication, rate limiting, and transformations

_format_version: "3.0"

services:
  # Product Service
  - name: product-service
    url: http://product-service:3000
    routes:
      - name: product-route
        paths:
          - /api/products
        strip_path: false
    plugins:
      - name: rate-limiting
        config:
          minute: 100
          hour: 1000
          policy: local
      - name: cors
        config:
          origins:
            - "*"
          methods:
            - GET
            - POST
            - PUT
            - DELETE
            - OPTIONS
          headers:
            - Accept
            - Accept-Version
            - Content-Length
            - Content-MD5
            - Content-Type
            - Date
            - Authorization
          exposed_headers:
            - X-Total-Count
          max_age: 3600
          credentials: true

  # Order Service
  - name: order-service
    url: http://order-service:3000
    routes:
      - name: order-route
        paths:
          - /api/orders
        strip_path: false
    plugins:
      - name: jwt
        config:
          uri_param_names:
            - jwt
      - name: rate-limiting
        config:
          minute: 50
          hour: 500
      - name: request-transformer
        config:
          add:
            headers:
              - X-Gateway:Kong

  # User Service
  - name: user-service
    url: http://user-service:3000
    routes:
      - name: user-route
        paths:
          - /api/users
        strip_path: false
    plugins:
      - name: acl
        config:
          allow:
            - admin
            - user
      - name: key-auth

consumers:
  - username: admin-user
    keyauth_credentials:
      - key: admin-secret-key
    acl:
      - admin

  - username: regular-user
    keyauth_credentials:
      - key: user-secret-key
    acl:
      - user
`,

    'kong/kubernetes-deployment.yaml': `# Kong Gateway Deployment on Kubernetes

apiVersion: v1
kind: Namespace
metadata:
  name: kong

---
# Kong configuration with custom plugins
apiVersion: v1
kind: ConfigMap
metadata:
  name: kong-config
  namespace: kong
data:
  kong.conf: |
    proxy_listen = 0.0.0.0:8000, 0.0.0.0:8443 ssl
    admin_listen = 0.0.0.0:8001
    database = off
    nginx_worker_processes = 2
    nginx_worker_shutdown_timeout = 240s
    ssl_protocols = TLSv1.2 TLSv1.3
    ssl_cipher_suite = ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256
    plugins = bundled,cors,key-auth,acl,jwt,rate-limiting,request-transformer

---
apiVersion: v1
kind: Service
metadata:
  name: kong-proxy
  namespace: kong
spec:
  type: LoadBalancer
  ports:
    - name: proxy
      port: 80
      targetPort: 8000
    - name: proxy-ssl
      port: 443
      targetPort: 8443
  selector:
    app: kong

---
apiVersion: v1
kind: Service
metadata:
  name: kong-admin
  namespace: kong
spec:
  type: ClusterIP
  ports:
    - name: admin
      port: 8001
      targetPort: 8001
  selector:
    app: kong

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kong
  namespace: kong
spec:
  replicas: 2
  selector:
    matchLabels:
      app: kong
  template:
    metadata:
      labels:
        app: kong
    spec:
      containers:
      - name: kong
        image: kong:3.4.0-alpine
        ports:
        - containerPort: 8000
          name: proxy
        - containerPort: 8443
          name: proxy-ssl
        - containerPort: 8001
          name: admin
        env:
        - name: KONG_DATABASE
          value: "off"
        - name: KONG_PROXY_ACCESS_LOG
          value: /dev/stdout
        - name: KONG_ADMIN_ACCESS_LOG
          value: /dev/stdout
        - name: KONG_PROXY_ERROR_LOG
          value: /dev/stderr
        - name: KONG_ADMIN_ERROR_LOG
          value: /dev/stderr
        - name: KONG_LOG_LEVEL
          value: debug
        - name: KONG_ADMIN_LISTEN
          value: 0.0.0.0:8001
        volumeMounts:
        - name: config
          mountPath: /etc/kong/kong.conf
          subPath: kong.conf
        livenessProbe:
          httpGet:
            path: /status
            port: 8443
            scheme: HTTPS
          initialDelaySeconds: 5
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /status
            port: 8443
            scheme: HTTPS
          initialDelaySeconds: 5
          periodSeconds: 10
      volumes:
      - name: config
        configMap:
          name: kong-config

---
# Kong Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kong-ingress
  namespace: kong
  annotations:
    kubernetes.io/ingress.class: kong
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: kong-proxy
                port:
                  number: 80
`,

    'ambassador/ambassador-config.yaml': `# Ambassador API Gateway Configuration
# Edge Stack API Gateway with mappings and filters

apiVersion: v1
kind: Namespace
metadata:
  name: ambassador

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ambassador
  namespace: ambassador

---
# Ambassador Listener
apiVersion: getambassador.io/v3alpha1
kind: Listener
metadata:
  name: ambassador-listener
  namespace: ambassador
spec:
  port: 8080
  protocol: HTTP
  securityModel: XFP
  hostMapping:
    - hostname: "*"
      port: 8080

---
# Product Service Mapping
apiVersion: getambassador.io/v3alpha1
kind: Mapping
metadata:
  name: product-mapping
  namespace: ambassador
spec:
  hostname: "*"
  prefix: /api/products
  service: product-service.production.svc.cluster.local:3000
  bypass_auth: true

---
# Order Service Mapping with Auth
apiVersion: getambassador.io/v3alpha1
kind: Mapping
metadata:
  name: order-mapping
  namespace: ambassador
spec:
  hostname: "*"
  prefix: /api/orders
  service: order-service.production.svc.cluster.local:3000
  precedence: 10

---
# User Service Mapping
apiVersion: getambassador.io/v3alpha1
kind: Mapping
metadata:
  name: user-mapping
  namespace: ambassador
spec:
  hostname: "*"
  prefix: /api/users
  service: user-service.production.svc.cluster.local:3000

---
# JWT Authentication Filter
apiVersion: getambassador.io/v3alpha1
kind: Filter
metadata:
  name: jwt-auth
  namespace: ambassador
spec:
  JWT:
      providers:
        - name: "my-provider"
          issuer: "https://auth.example.com"
          audiences:
            - "my-api"
          jwks:
            - url: "https://auth.example.com/.well-known/jwks.json"
          TTL: 3600

---
# Rate Limit Filter
apiVersion: getambassador.io/v3alpha1
kind: Filter
metadata:
  name: rate-limit
  namespace: ambassador
spec:
  RateLimit:
      descriptors:
          - key: remote_address
            rate: 100
            unit: minute

---
# CORS Filter
apiVersion: getambassador.io/v3alpha1
kind: Filter
metadata:
  name: cors-filter
  namespace: ambassador
spec:
  CORS:
      origins:
        - https://example.com
        - https://www.example.com
      methods:
        - GET
        - POST
        - PUT
        - DELETE
        - OPTIONS
      headers:
        - Accept
        - Authorization
        - Content-Type
      exposedHeaders:
        - X-Custom-Header
      maxAge: 86400
      credentials: true

---
# Apply filters to order mapping
apiVersion: getambassador.io/v3alpha1
kind: FilterPolicy
metadata:
  name: order-policy
  namespace: ambassador
spec:
  rules:
    - host: "*"
      path: /api/orders/*
      filters:
        - name: jwt-auth
        - name: rate-limit
        - name: cors-filter

---
# Ambassador Deployment
apiVersion: getambassador.io/v3alpha1
kind: AmbassadorInstallation
metadata:
  name: ambassador
  namespace: ambassador
spec:
  ambassadorID: ambassador
  deployment:
    replicas: 2
    resources:
      limits:
        cpu: 500m
        memory: 400Mi
      requests:
        cpu: 100m
        memory: 200Mi
`,

    'istio/gateway.yaml': `# Istio Gateway Configuration
# API Gateway with virtual services and destination rules

apiVersion: v1
kind: Namespace
metadata:
  name: istio-gateway

---
# Gateway for external access
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: public-gateway
  namespace: istio-gateway
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
        credentialName: ingress-cert
      hosts:
        - "api.example.com"

---
# Virtual Service for product API
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: product-api
  namespace: istio-gateway
spec:
  hosts:
    - "api.example.com"
  gateways:
    - public-gateway
  http:
    - match:
        - uri:
            prefix: /api/products
      route:
        - destination:
            host: product-service
            port:
              number: 3000
      timeout: 10s
      retries:
        attempts: 3
        perTryTimeout: 3s
        retryOn: 5xx,connect-failure,refused-stream
      corsPolicy:
        allowOrigin:
          - exact: https://example.com
        allowMethods:
          - GET
          - POST
          - PUT
          - DELETE
          - OPTIONS
        allowHeaders:
          - Authorization
          - Content-Type
          - Accept
        exposeHeaders:
          - X-Custom-Header
        maxAge: 24h
        allowCredentials: true

---
# Virtual Service for order API with auth
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: order-api
  namespace: istio-gateway
spec:
  hosts:
    - "api.example.com"
  gateways:
    - public-gateway
  http:
    - match:
        - uri:
            prefix: /api/orders
      route:
        - destination:
            host: order-service
            port:
              number: 3000
      fault:
        delay:
          percentage:
            value: 0.1
          fixedDelay: 1s
      corsPolicy:
        allowOrigin:
          - exact: https://example.com
        allowMethods:
          - GET
          - POST
          - PUT
          - DELETE
        allowHeaders:
          - Authorization
          - Content-Type
        maxAge: 24h

---
# Request Authentication
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
  name: jwt-authn
  namespace: istio-gateway
spec:
  selector:
    matchLabels:
      app: istio-ingressgateway
  jwtRules:
    - issuer: "https://auth.example.com"
      jwks:
        uri: "https://auth.example.com/.well-known/jwks.json"
      audiences:
        - "my-api"

---
# Authorization Policy
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: authz-policy
  namespace: istio-gateway
spec:
  selector:
    matchLabels:
      app: istio-ingressgateway
  action: ALLOW
  rules:
    - from:
        - source:
            requestPrincipals:
              - "*"
      to:
        - operation:
            methods:
              - GET
              - POST
              - PUT
              - DELETE
            notPaths:
              - /health
              - /metrics

---
# Destination Rule for load balancing
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: product-service-dr
  namespace: istio-gateway
spec:
  host: product-service
  trafficPolicy:
    loadBalancer:
      simple: LEAST_CONN
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http2MaxRequests: 100
        maxRequestsPerConnection: 10
    outlierDetection:
      consecutiveErrors: 3
      interval: 30s
      baseEjectionTime: 30s

---
# Service Entry for external API
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: external-api
  namespace: istio-gateway
spec:
  hosts:
    - external-api.example.com
  location: MESH_EXTERNAL
  ports:
    - number: 443
      name: https
      protocol: HTTPS
  resolution: DNS
`,
    'gateway-selector/gateway-config.ts': `// API Gateway Selector
// Automatically routes requests to appropriate gateway

interface GatewayConfig {
  type: 'kong' | 'ambassador' | 'istio';
  features: {
    rateLimiting: boolean;
    jwtAuth: boolean;
    cors: boolean;
    caching: boolean;
  };
}

export class GatewaySelector {
  private configs: Map<string, GatewayConfig> = new Map();

  constructor() {
    this.configs.set('kong', {
      type: 'kong',
      features: {
        rateLimiting: true,
        jwtAuth: true,
        cors: true,
        caching: true,
      },
    });

    this.configs.set('ambassador', {
      type: 'ambassador',
      features: {
        rateLimiting: true,
        jwtAuth: true,
        cors: true,
        caching: false,
      },
    });

    this.configs.set('istio', {
      type: 'istio',
      features: {
        rateLimiting: true,
        jwtAuth: true,
        cors: true,
        caching: true,
      },
    });
  }

  selectGateway(requiredFeatures: string[]): string | null {
    for (const [name, config] of this.configs) {
      const hasAllFeatures = requiredFeatures.every(feature => {
        return config.features[feature as keyof typeof config.features];
      });

      if (hasAllFeatures) {
        return name;
      }
    }

    return null;
  }

  getGatewayConfig(type: string): GatewayConfig | undefined {
    return this.configs.get(type);
  }
}

export const gatewaySelector = new GatewaySelector();
`,

    'docker-compose.yml': `version: '3.8'

services:
  # Kong Gateway
  kong:
    image: kong:3.4.0-alpine
    container_name: kong-gateway
    ports:
      - "8000:8000"
      - "8443:8443"
      - "8001:8001"
    environment:
      KONG_DATABASE: "off"
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_LISTEN: "0.0.0.0:8001"
      KONG_LOG_LEVEL: debug
    networks:
      - gateway-net

  # Ambassador
  ambassador:
    image: quay.io/datawire/ambassador:3.5.0
    container_name: ambassador-gateway
    ports:
      - "8080:8080"
      - "8443:8443"
      - "8877:8877"
    environment:
      AMBASSADOR_ID: ambassador
      AMBASSADOR_KNATIVE: "false"
      AMBASSADOR_SINGLE_NAMESPACE: "true"
    networks:
      - gateway-net

  # Istio Ingress Gateway
  istio-ingress:
    image: istio/proxyv2:1.19.0
    container_name: istio-gateway
    ports:
      - "8081:8080"
      - "8444:8443"
    environment:
      ISTIO_META_ROUTER_MODE: sni-dnat
    networks:
      - gateway-net

  # Product Service
  product-service:
    image: myorg/product-service:1.0.0
    container_name: product-service
    ports:
      - "3001:3000"
    environment:
      PORT: 3000
    networks:
      - gateway-net

  # Order Service
  order-service:
    image: myorg/order-service:1.0.0
    container_name: order-service
    ports:
      - "3002:3000"
    environment:
      PORT: 3000
    networks:
      - gateway-net

  # User Service
  user-service:
    image: myorg/user-service:1.0.0
    container_name: user-service
    ports:
      - "3003:3000"
    environment:
      PORT: 3000
    networks:
      - gateway-net

networks:
  gateway-net:
    driver: bridge
`,

    'README.md': `# API Gateway Integration

Complete API gateway integration with Kong, Ambassador, and Istio Gateway including rate limiting, authentication, transformations, and routing.

## Features

### Kong Gateway
- Plugin-based architecture
- Rate limiting and throttling
- JWT and key authentication
- Request/response transformation
- CORS configuration

### Ambassador Edge Stack
- Kubernetes-native CRDs
- Filter-based configuration
- JWT authentication
- Rate limiting
- CORS and security headers

### Istio Gateway
- Service mesh integration
- mTLS and JWT authentication
- Traffic splitting and mirroring
- Circuit breaking and timeouts
- Observability and metrics

## Quick Start

bash code for starting the gateways

## License

MIT
`,

    'Makefile': `.PHONY: help start-kong start-ambassador start-istio stop clean

help:
	@echo "Available targets: start-kong start-ambassador start-istio stop clean"

start-kong:
	docker-compose up -d kong product-service order-service user-service

start-ambassador:
	docker-compose up -d ambassador product-service order-service user-service

start-istio:
	docker-compose up -d istio-ingress product-service order-service user-service

stop:
	docker-compose down

clean:
	docker-compose down -v
`
  },

  postInstall: [
    `echo "Setting up API gateway integration..."
echo ""
echo "Available Gateways:"
echo "- Kong: Plugin-based with rich ecosystem"
echo "- Ambassador: Kubernetes-native"
echo "- Istio: Service mesh integration"
echo ""
echo "Quick Start:"
echo "  make start-kong"
echo ""
echo "Kong Admin API: http://localhost:8001"
echo "Kong Proxy: http://localhost:8000"
`
  ]
};
