import { BackendTemplate } from '../types';

/**
 * Service Dependency Management Template
 * Service startup ordering and dependency management
 */
export const serviceDependenciesTemplate: BackendTemplate = {
  id: 'service-dependencies',
  name: 'Service Dependencies',
  displayName: 'Dependency & Startup Management',
  description: 'Complete service dependency management with startup ordering, health checks, init containers, dependency injection, and service mesh integration',
  version: '1.0.0',
  language: 'typescript',
  framework: 'kubernetes',
  tags: ['kubernetes', 'dependencies', 'startup', 'health-check', 'init-containers'],
  port: 3000,
  dependencies: {},
  features: ['monitoring', 'security', 'documentation'],

  files: {
    'dependencies/dependency-manager.ts': `// Service Dependency Manager
// Manages service dependencies and startup ordering

interface ServiceDependency {
  name: string;
  healthCheckUrl: string;
  timeout: number;
  required: boolean;
}

interface DependencyConfig {
  services: ServiceDependency[];
  startupTimeout: number;
  retryInterval: number;
}

export class ServiceDependencyManager {
  private dependencies: Map<string, ServiceDependency>;
  private startupTimeout: number;
  private retryInterval: number;

  constructor(config: DependencyConfig) {
    this.dependencies = new Map(
      config.services.map(s => [s.name, s])
    );
    this.startupTimeout = config.startupTimeout;
    this.retryInterval = config.retryInterval;
  }

  async waitForDependencies(): Promise<void> {
    console.log('Waiting for service dependencies...');

    const startTime = Date.now();
    const results = await Promise.allSettled(
      Array.from(this.dependencies.values()).map(dep =>
        this.checkService(dep)
      )
    );

    const failures = results.filter(r => r.status === 'rejected');

    for (const failure of failures) {
      const depName = (failure as any).reason?.service;
      const dependency = this.dependencies.get(depName);

      if (dependency?.required) {
        throw new Error(\`Required dependency '\${depName}' is not available\`);
      } else {
        console.warn(\`Optional dependency '\${depName}' is not available\`);
      }
    }

    console.log('All dependencies are ready');
  }

  private async checkService(dependency: ServiceDependency): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < this.startupTimeout) {
      try {
        const response = await fetch(dependency.healthCheckUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(dependency.timeout),
        });

        if (response.ok) {
          console.log(\`Dependency '\${dependency.name}' is ready\`);
          return;
        }
      } catch (error) {
        console.log(\`Waiting for dependency '\${dependency.name}'...\`);
      }

      await this.sleep(this.retryInterval);
    }

    throw { service: dependency.name };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getDependencyStatus(): Map<string, boolean> {
    const status = new Map<string, boolean>();
    for (const [name] of this.dependencies) {
      status.set(name, false);
    }
    return status;
  }
}

// Usage example
const dependencyManager = new ServiceDependencyManager({
  services: [
    {
      name: 'postgres',
      healthCheckUrl: 'http://postgres:5432/health',
      timeout: 2000,
      required: true,
    },
    {
      name: 'redis',
      healthCheckUrl: 'http://redis:6379/ping',
      timeout: 1000,
      required: true,
    },
    {
      name: 'analytics',
      healthCheckUrl: 'http://analytics:3000/health',
      timeout: 3000,
      required: false,
    },
  ],
  startupTimeout: 60000,
  retryInterval: 2000,
});

// await dependencyManager.waitForDependencies();
`,

    'dependencies/health-check.ts': `// Health Check Endpoints
// Standard health check implementations for services

import { Request, Response } from 'express';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  dependencies: Record<string, boolean>;
  checks: Record<string, HealthCheckResult>;
}

export interface HealthCheckResult {
  status: 'pass' | 'fail' | 'warn';
  description?: string;
  responseTime?: number;
}

export class HealthChecker {
  private checks: Map<string, () => Promise<HealthCheckResult>> = new Map();

  constructor(
    private serviceName: string,
    private version: string,
  ) {}

  addCheck(name: string, check: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, check);
  }

  async getHealth(): Promise<HealthStatus> {
    const results: Record<string, HealthCheckResult> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    for (const [name, check] of this.checks) {
      try {
        const start = Date.now();
        const result = await check();
        result.responseTime = Date.now() - start;
        results[name] = result;

        if (result.status === 'fail') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'warn' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        results[name] = {
          status: 'fail',
          description: error instanceof Error ? error.message : 'Unknown error',
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: this.version,
      dependencies: this.extractDependencyStatus(results),
      checks: results,
    };
  }

  private extractDependencyStatus(checks: Record<string, HealthCheckResult>): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const [name, result] of Object.entries(checks)) {
      status[name] = result.status === 'pass';
    }
    return status;
  }

  middleware() {
    return async (req: Request, res: Response): Promise<void> => {
      const health = await this.getHealth();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(health);
    };
  }

  readyMiddleware() {
    return async (req: Request, res: Response): Promise<void> => {
      const health = await this.getHealth();
      const isReady = health.status !== 'unhealthy';
      res.status(isReady ? 200 : 503).json({
        ready: isReady,
        status: health.status,
      });
    };
  }

  liveMiddleware() {
    return async (_req: Request, res: Response): Promise<void> => {
      res.status(200).json({ live: true });
    };
  }
}

// Usage
export const healthChecker = new HealthChecker('my-service', '1.0.0');
`,

    'kubernetes/init-containers.yaml': `# Init Containers for Dependency Management
# Ensures dependencies are ready before main container starts

apiVersion: v1
kind: Pod
metadata:
  name: myapp-with-init
spec:
  containers:
  - name: myapp
    image: myorg/myapp:1.0.0
    ports:
    - containerPort: 3000
    env:
    - name: DATABASE_URL
      value: "postgresql://postgres:5432/mydb"
    - name: REDIS_URL
      value: "redis://redis:6379"
  # Init container to wait for PostgreSQL
  initContainers:
  - name: wait-for-postgres
    image: busybox:1.36
    command:
    - sh
    - -c
    - |
      until nc -z postgres 5432; do
        echo "Waiting for PostgreSQL..."
        sleep 2
      done
      echo "PostgreSQL is ready!"
  # Init container to wait for Redis
  - name: wait-for-redis
    image: busybox:1.36
    command:
    - sh
    - -c
    - |
      until nc -z redis 6379; do
        echo "Waiting for Redis..."
        sleep 2
      done
      echo "Redis is ready!"
`,

    'kubernetes/startup-probe.yaml': `# Startup Probe for Gradual Startup
# Gives containers time to start before health checks begin

apiVersion: v1
kind: Pod
metadata:
  name: myapp-with-startup-probe
spec:
  containers:
  - name: myapp
    image: myorg/myapp:1.0.0
    ports:
    - containerPort: 3000
    # Startup probe - gives container 60s to start
    startupProbe:
      httpGet:
        path: /health/startup
        port: 3000
      failureThreshold: 30
      periodSeconds: 2
    # Liveness probe - runs after startup succeeds
    livenessProbe:
      httpGet:
        path: /health/live
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3
    # Readiness probe - container ready to serve traffic
    readinessProbe:
      httpGet:
        path: /health/ready
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 5
      timeoutSeconds: 3
      failureThreshold: 3
`,

    'kubernetes/dependency-order.yaml': `# Service Startup Ordering with ArgoCD
# Resource hooks and sync waves for ordered deployment

apiVersion: batch/v1
kind: Job
metadata:
  name: postgres-migration
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation
spec:
  template:
    spec:
      containers:
      - name: migrate
        image: myorg/migrate:1.0.0
        command: ['npm', 'run', 'migrate']
      restartPolicy: Never

---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  annotations:
    argocd.argoproj.io/sync-wave: "1"
spec:
  ports:
  - port: 5432
  selector:
    app: postgres

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  annotations:
    argocd.argoproj.io/sync-wave: "1"
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine

---
apiVersion: v1
kind: Service
metadata:
  name: redis
  annotations:
    argocd.argoproj.io/sync-wave: "2"
spec:
  ports:
  - port: 6379
  selector:
    app: redis

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  annotations:
    argocd.argoproj.io/sync-wave: "2"
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine

---
apiVersion: v1
kind: Service
metadata:
  name: myapp
  annotations:
    argocd.argoproj.io/sync-wave: "3"
spec:
  ports:
  - port: 3000
  selector:
    app: myapp

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  annotations:
    argocd.argoproj.io/sync-wave: "3"
spec:
  replicas: 3
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
        image: myorg/myapp:1.0.0
        ports:
        - containerPort: 3000
`,

    'istio/dependency-management.yaml': `# Istio Dependency Management
# Service entry and traffic policies for dependencies

apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: external-postgres
spec:
  hosts:
    - postgres.external.com
  location: MESH_EXTERNAL
  ports:
    - number: 5432
      name: postgres
      protocol: TCP
  resolution: DNS

---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: postgres-dependency
spec:
  host: postgres.default.svc.cluster.local
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
        connectTimeout: 10s
        tcpKeepalive:
          time: 7200s
          interval: 75s
    outlierDetection:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50

---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: dependency-timeouts
spec:
  hosts:
    - myapp
  http:
    - route:
        - destination:
            host: myapp
      timeout: 30s
      retries:
        attempts: 3
        perTryTimeout: 10s
        retryOn: 5xx,connect-failure,refused-stream
`,

    'linkerd/service-profiler.yaml': `# Linkerd Service Profiler
# Dependency visualization and management

apiVersion: linkerd.io/v1alpha2
kind: ServiceProfile
metadata:
  name: myapp
  namespace: production
spec:
  routes:
    - name: GET /api/products
      condition:
        method: GET
        path: /api/products
    - name: POST /api/orders
      condition:
        method: POST
        path: /api/orders
  retryPolicy:
    # Retry on 500s and connection errors
    perTryTimeout: 100ms
    maxRetries: 5
    backoff:
      baseMs: 100
      maxMs: 1000
`,
    'docker-compose-dependencies.yml': `version: '3.8'

services:
  # Database (Layer 1 - Foundation)
  postgres:
    image: postgres:15-alpine
    container_name: postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    networks:
      - app-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Cache (Layer 1 - Foundation)
  redis:
    image: redis:7-alpine
    container_name: redis
    ports:
      - "6379:6379"
    networks:
      - app-net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Message Queue (Layer 2 - Infrastructure)
  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    networks:
      - app-net
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    depends_on:
      postgres:
        condition: service_healthy

  # API Service (Layer 3 - Application)
  api-service:
    image: myorg/api-service:1.0.0
    container_name: api-service
    ports:
      - "3001:3000"
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/myapp
      REDIS_URL: redis://redis:6379
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672
    networks:
      - app-net
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s

  # Worker Service (Layer 3 - Application)
  worker-service:
    image: myorg/worker-service:1.0.0
    container_name: worker-service
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/myapp
      REDIS_URL: redis://redis:6379
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672
    networks:
      - app-net
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy

  # Web Service (Layer 4 - Frontend)
  web-service:
    image: myorg/web-service:1.0.0
    container_name: web-service
    ports:
      - "3000:3000"
    environment:
      API_URL: http://api-service:3000
    networks:
      - app-net
    depends_on:
      api-service:
        condition: service_healthy

networks:
  app-net:
    driver: bridge
`,

    'scripts/wait-for.sh': `#!/bin/bash
# Wait for a service to be ready

wait_for_service() {
    local host=host
    local port=port
    local timeout=60
    local elapsed=0

    echo "Waiting for service..."

    while true; do
        if nc -z "host" "port" 2>/dev/null; then
            echo "Service is ready!"
            return 0
        fi
        sleep 2
    done
}

# Usage
wait_for_service
`,

    'examples/health-endpoints.ts': `// Health Check Endpoints Example

import { healthChecker } from '../dependencies/health-check';
import { ServiceDependencyManager } from '../dependencies/dependency-manager';

// Setup health checks
healthChecker.addCheck('database', async () => {
  try {
    const start = Date.now();
    const response = await fetch('http://postgres:5432/health');
    const responseTime = Date.now() - start;

    if (response.ok) {
      return { status: 'pass', description: 'Database is healthy', responseTime };
    }
    return { status: 'fail', description: 'Database is unhealthy', responseTime };
  } catch {
    return { status: 'fail', description: 'Database is unreachable' };
  }
});

healthChecker.addCheck('redis', async () => {
  try {
    const start = Date.now();
    const response = await fetch('http://redis:6379/ping');
    const responseTime = Date.now() - start;

    if (response.ok) {
      return { status: 'pass', description: 'Redis is healthy', responseTime };
    }
    return { status: 'fail', description: 'Redis is unhealthy', responseTime };
  } catch {
    return { status: 'fail', description: 'Redis is unreachable' };
  }
});

healthChecker.addCheck('memory', async () => {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  const heapTotalMB = usage.heapTotal / 1024 / 1024;

  if (heapUsedMB > heapTotalMB * 0.9) {
    return { status: 'warn', description: 'Memory usage is high' };
  }
  return { status: 'pass', description: 'Memory is OK' };
});

// Express app setup
import express from 'express';

const app = express();

// Health endpoints
app.get('/health', healthChecker.middleware());
app.get('/health/ready', healthChecker.readyMiddleware());
app.get('/health/live', healthChecker.liveMiddleware());
app.get('/health/startup', (_req, res) => res.json({ status: 'starting' });

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
`,

    'README.md': `# Service Dependency Management

Complete service dependency management with startup ordering, health checks, init containers, and service mesh integration.

## Features

### Dependency Manager
- Automatic dependency waiting
- Health check verification
- Required vs optional dependencies
- Configurable timeouts and retries

### Health Checks
- Liveness, readiness, and startup probes
- Per-dependency health status
- Response time tracking
- Degraded state handling

### Kubernetes Integration
- Init containers for dependencies
- Startup probes for gradual startup
- ArgoCD sync waves for ordering
- Resource hooks for migrations

### Service Mesh
- Istio service entries
- Linkerd service profiles
- Traffic policies and timeouts
- Outlier detection

## Quick Start

bash code for starting the services

## License

MIT
`,

    'Makefile': `.PHONY: help start stop clean

help:
	@echo "Available targets: start stop clean"

start:
	docker-compose -f docker-compose-dependencies.yml up -d

stop:
	docker-compose -f docker-compose-dependencies.yml down

clean:
	docker-compose -f docker-compose-dependencies.yml down -v
`
  },

  postInstall: [
    `echo "Setting up service dependency management..."
echo ""
echo "Dependency Features:"
echo "- Automatic dependency waiting"
echo "- Health check verification"
echo "- Kubernetes init containers"
echo "- ArgoCD sync waves for ordering"
echo ""
echo "Quick Start:"
echo "  make start"
echo ""
echo "Check service health:"
echo "  curl http://localhost:3000/health"
`
  ]
};
