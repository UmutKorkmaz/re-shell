import { BackendTemplate } from '../types';

/**
 * CORS Configuration Template
 * Cross-Origin Resource Sharing configuration for microfrontend communication
 */
export const corsConfigTemplate: BackendTemplate = {
  id: 'cors-config',
  name: 'CORS Configuration',
  displayName: 'CORS & Microfrontend Communication',
  description: 'Complete CORS configuration for microfrontend communication with multiple origins, credentials, preflight handling, and security policies',
  version: '1.0.0',
  language: 'typescript',
  framework: 'cors',
  tags: ['kubernetes', 'cors', 'microfrontend', 'security', 'api'],
  port: 3000,
  dependencies: {},
  features: ['security', 'cors', 'documentation'],

  files: {
    'cors/cors-middleware.ts': `// CORS Middleware Configuration
// Cross-Origin Resource Sharing for microfrontend communication

import { Request, Response, NextFunction } from 'express';

export interface CorsConfig {
  origins: string[];
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  optionsSuccessStatus: number;
}

export const defaultCorsConfig: CorsConfig = {
  origins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://app.example.com',
    'https://admin.example.com',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Client-Version',
    'X-Request-ID',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-Per-Page'],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

export class CorsMiddleware {
  private config: CorsConfig;
  private originPatterns: RegExp[];

  constructor(config: Partial<CorsConfig> = {}) {
    this.config = { ...defaultCorsConfig, ...config };
    this.originPatterns = this.compileOriginPatterns();
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const origin = req.headers.origin;

      if (!origin) {
        next();
        return;
      }

      if (this.isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);

        if (this.config.credentials) {
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }

        if (req.method === 'OPTIONS') {
          this.handlePreflight(req, res);
          return;
        }

        if (this.config.exposedHeaders.length > 0) {
          res.setHeader(
            'Access-Control-Expose-Headers',
            this.config.exposedHeaders.join(', ')
          );
        }
      }

      next();
    };
  }

  private handlePreflight(req: Request, res: Response): void {
    res.setHeader(
      'Access-Control-Allow-Methods',
      this.config.methods.join(', ')
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      this.config.allowedHeaders.join(', ')
    );
    res.setHeader('Access-Control-Max-Age', this.config.maxAge.toString());

    // Vary header is important for caching
    res.setHeader('Vary', 'Origin');

    res.status(this.config.optionsSuccessStatus).end();
  }

  private isOriginAllowed(origin: string): boolean {
    return this.config.origins.includes(origin) ||
      this.originPatterns.some(pattern => pattern.test(origin));
  }

  private compileOriginPatterns(): RegExp[] {
    return this.config.origins
      .filter(origin => origin.includes('*'))
      .map(origin => {
        const pattern = origin
          .replace(/./g, '\\.')
          .replace(/*/g, '.*');
        return new RegExp('^' + pattern + '$');
      });
  }

  updateConfig(config: Partial<CorsConfig>): void {
    this.config = { ...this.config, ...config };
    this.originPatterns = this.compileOriginPatterns();
  }
}

// Factory function
export const createCorsMiddleware = (config?: Partial<CorsConfig>) => {
  const middleware = new CorsMiddleware(config);
  return middleware.middleware();
};

// Express app usage
export const corsMiddleware = createCorsMiddleware();
`,

    'cors/express-setup.ts': `// Express CORS Setup
// Complete Express application with CORS configuration

import express, { Application } from 'express';
import { createCorsMiddleware } from './cors-middleware';

export function createApp(): Application {
  const app = express();

  // JSON body parser
  app.use(express.json());

  // CORS middleware
  app.use(createCorsMiddleware({
    origins: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://*.example.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Client-Version',
    ],
    exposedHeaders: ['X-Total-Count'],
    credentials: true,
    maxAge: 86400,
  }));

  // Routes
  app.get('/api/data', (req, res) => {
    res.json({ message: 'CORS enabled endpoint' });
  });

  // Health check (no CORS needed)
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
  });

  return app;
}

export const app = createApp();

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
  });
}
`,

    'cors/fastify-setup.ts': `// Fastify CORS Setup
// Fastify application with @fastify/cors plugin

import Fastify, { FastifyInstance } from 'fastify';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // Register CORS plugin
  await app.register(import('@fastify/cors'), {
    origin: (origin, cb) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://app.example.com',
      ];

      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }

      // Check for wildcard subdomains
      const hostname = new URL(origin).hostname;
      if (hostname.endsWith('.example.com')) {
        cb(null, true);
        return;
      }

      cb(new Error('Not allowed'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version'],
    exposedHeaders: ['X-Total-Count'],
    credentials: true,
    maxAge: 86400,
  });

  // Routes
  app.get('/api/data', async (request, reply) => {
    return { message: 'CORS enabled endpoint' };
  });

  return app;
}
`,

    'cors/nextjs-api.ts': `// Next.js API Route CORS Configuration
// API route handlers with CORS for microfrontend

import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Set CORS headers
  const origin = req.headers.origin;

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://app.example.com',
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // API logic
  res.status(200).json({ message: 'Success' });
}
`,

    'kubernetes/ingress-cors.yaml': `# Kubernetes Ingress with CORS Configuration

apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: production
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "http://localhost:3000,http://localhost:3001,https://*.example.com"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "Content-Type, Authorization, X-Client-Version"
    nginx.ingress.kubernetes.io/cors-expose-headers: "X-Total-Count, X-Page-Count"
    nginx.ingress.kubernetes.io/cors-allow-credentials: "true"
    nginx.ingress.kubernetes.io/cors-max-age: "86400"
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 3000

---
# Traefik Ingress with CORS
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress-traefik
  namespace: production
  annotations:
    traefik.ingress.kubernetes.io/router.middlewares: "cors-headers"
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 3000

---
# CORS Middleware for Traefik
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: cors-headers
  namespace: production
spec:
  headers:
    accessControlAllowMethods:
      - GET
      - POST
      - PUT
      - DELETE
      - PATCH
      - OPTIONS
    accessControlAllowHeaders:
      - Content-Type
      - Authorization
      - X-Client-Version
    accessControlExposeHeaders:
      - X-Total-Count
    accessControlAllowOriginList:
      - http://localhost:3000
      - http://localhost:3001
      - https://app.example.com
    accessControlMaxAge: 86400
    accessControlAllowCredentials: true
`,

    'kubernetes/gateway-api-cors.yaml': `# Kubernetes Gateway API with CORS
# Using Gateway API v1beta1 for HTTPRoute configuration

apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: api-gateway
  namespace: production
spec:
  gatewayClassName: nginx
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      hostname: api.example.com

---
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: api-route
  namespace: production
spec:
  parentRefs:
    - name: api-gateway
  hostnames:
    - "api.example.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      filters:
        - type: ResponseHeaderModifier
          responseHeaderModifier:
            set:
              - name: Access-Control-Allow-Origin
                value: "http://localhost:3000"
              - name: Access-Control-Allow-Credentials
                value: "true"
            add:
              - name: Access-Control-Allow-Methods
                value: "GET, POST, PUT, DELETE, OPTIONS"
              - name: Access-Control-Allow-Headers
                value: "Content-Type, Authorization"
      backendRefs:
        - name: api-service
          port: 3000
`,

    'istio/virtual-service-cors.yaml': `# Istio VirtualService with CORS Configuration

apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-cors
  namespace: production
spec:
  hosts:
    - "api.example.com"
  gateways:
    - public-gateway
  http:
    - match:
        - uri:
            prefix: /api
      corsPolicy:
        allowOrigins:
          - exact: http://localhost:3000
          - exact: http://localhost:3001
          - regex: "https://.*\\.example\\.com"
        allowMethods:
          - GET
          - POST
          - PUT
          - DELETE
          - PATCH
          - OPTIONS
        allowHeaders:
          - Content-Type
          - Authorization
          - X-Client-Version
          - X-Requested-With
        exposeHeaders:
          - X-Total-Count
          - X-Page-Count
        maxAge: 86400
        allowCredentials: true
      route:
        - destination:
            host: api-service
            port:
              number: 3000
`,

    'envoy/cors-filter.yaml': `# Envoy CORS Filter Configuration
# Apply CORS headers at the proxy level

typed_config:
  "@type": type.googleapis.com/envoy.extensions.filters.http.cors.v3.Cors
  cors_policy:
    allow_origins:
      - regex: "http://localhost:[0-9]+"
      - exact: https://app.example.com
      - suffix: ".example.com"
    allow_methods:
      - GET
      - POST
      - PUT
      - DELETE
      - PATCH
      - OPTIONS
    allow_headers:
      - Content-Type
      - Authorization
      - X-Client-Version
      - X-Requested-With
    expose_headers:
      - X-Total-Count
      - X-Page-Count
    max_age: 86400
    allow_credentials: true
    filter_enabled:
      runtime_key: cors_enabled
      default_value:
        numerator: 100
        denominator: HUNDRED
`,

    'microfrontend/microfrontends-gateway.ts': `// Microfrontend Gateway with CORS
// Module Federation gateway for multiple microfrontends

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createCorsMiddleware } from '../cors/cors-middleware';

export function createMicrofrontendGateway() {
  const app = express();

  // CORS for microfrontend communication
  app.use(createCorsMiddleware({
    origins: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'https://app.example.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Client-Version',
      'X-Microfrontend-ID',
    ],
    exposedHeaders: ['X-Total-Count'],
    credentials: true,
    maxAge: 86400,
  }));

  // Proxy to microfrontends
  app.use('/mf/auth', createProxyMiddleware({
    target: 'http://auth-mfe:3001',
    changeOrigin: true,
  }));

  app.use('/mf/dashboard', createProxyMiddleware({
    target: 'http://dashboard-mfe:3002',
    changeOrigin: true,
  }));

  app.use('/mf/catalog', createProxyMiddleware({
    target: 'http://catalog-mfe:3003',
    changeOrigin: true,
  }));

  // Backend APIs
  app.use('/api', createProxyMiddleware({
    target: 'http://backend-api:4000',
    changeOrigin: true,
  }));

  return app;
}

export const gateway = createMicrofrontendGateway();
`,

    'examples/cors-fetch.ts': `// CORS Fetch Examples
// Client-side fetch with CORS handling

export class ApiClient {
  private baseUrl: string;
  private credentials: RequestCredentials;

  constructor(baseUrl: string, credentials: RequestCredentials = 'include') {
    this.baseUrl = baseUrl;
    this.credentials = credentials;
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(\`\${this.baseUrl}\${path}\`, {
      method: 'GET',
      credentials: this.credentials,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0',
      },
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    return response.json();
  }

  async post<T>(path: string, data: unknown): Promise<T> {
    const response = await fetch(\`\${this.baseUrl}\${path}\`, {
      method: 'POST',
      credentials: this.credentials,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    return response.json();
  }

  // Preflight OPTIONS request (usually automatic)
  async options(path: string): Promise<void> {
    await fetch(\`\${this.baseUrl}\${path}\`, {
      method: 'OPTIONS',
      credentials: this.credentials,
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });
  }
}

// Usage
const apiClient = new ApiClient('https://api.example.com');
`,

    'docker-compose.yml': `version: '3.8'

services:
  # API Service with CORS
  api-service:
    image: myorg/api-service:1.0.0
    container_name: api-service
    ports:
      - "3000:3000"
    environment:
      - CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://app.example.com
      - CORS_CREDENTIALS=true
    networks:
      - cors-net

  # Microfrontend Auth
  auth-mfe:
    image: myorg/auth-mfe:1.0.0
    container_name: auth-mfe
    ports:
      - "3001:3000"
    environment:
      - CORS_ORIGINS=http://localhost:3000,https://app.example.com
    networks:
      - cors-net

  # Microfrontend Dashboard
  dashboard-mfe:
    image: myorg/dashboard-mfe:1.0.0
    container_name: dashboard-mfe
    ports:
      - "3002:3000"
    environment:
      - CORS_ORIGINS=http://localhost:3000,https://app.example.com
    networks:
      - cors-net

  # Gateway with CORS
  gateway:
    image: myorg/mfe-gateway:1.0.0
    container_name: gateway
    ports:
      - "8080:8080"
    environment:
      - CORS_ORIGINS=http://localhost:3000,https://app.example.com
      - CORS_CREDENTIALS=true
    networks:
      - cors-net
    depends_on:
      - api-service
      - auth-mfe
      - dashboard-mfe

networks:
  cors-net:
    driver: bridge
`,

    'README.md': `# CORS Configuration for Microfrontends

Complete CORS configuration for microfrontend communication with multiple origins, credentials, preflight handling, and security policies.

## Features

### CORS Middleware
- Express middleware for CORS
- Fastify plugin configuration
- Next.js API route CORS
- Dynamic origin validation

### Kubernetes Integration
- NGINX ingress CORS annotations
- Traefik middleware
- Gateway API HTTPRoute
- Istio VirtualService CORS policy
- Envoy CORS filter

### Microfrontend Gateway
- Module Federation gateway
- Per-route CORS policies
- Proxy middleware with CORS
- Cross-origin credentials

## Quick Start

bash code for starting the services

## License

MIT
`,

    'Makefile': `.PHONY: help start stop test clean

help:
	@echo "Available targets: start stop test clean"

start:
	docker-compose up -d

stop:
	docker-compose down

test:
	curl -X OPTIONS http://localhost:8080/api/data \\
	  -H "Origin: http://localhost:3000" \\
	  -H "Access-Control-Request-Method: GET" \\
	  -v

clean:
	docker-compose down -v
`
  },

  postInstall: [
    `echo "Setting up CORS configuration..."
echo ""
echo "CORS Features:"
echo "- Express/Fastify/Next.js middleware"
echo "- Kubernetes ingress CORS"
echo "- Istio VirtualService CORS"
echo "- Microfrontend gateway"
echo ""
echo "Quick Start:"
echo "  make start"
echo ""
echo "Test CORS:"
echo "  make test"
`
  ]
};
