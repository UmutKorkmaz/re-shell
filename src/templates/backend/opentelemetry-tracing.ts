/**
 * OpenTelemetry Distributed Tracing Template
 * Provides comprehensive distributed tracing and observability integration
 * with automatic instrumentation for common frameworks
 */

import { BackendTemplate } from '../backend';

export const openTelemetryTracingTemplate: BackendTemplate = {
  id: 'opentelemetry-tracing',
  name: 'opentelemetry-tracing',
  version: '1.0.0',
  displayName: 'OpenTelemetry Distributed Tracing',
  description: 'Comprehensive distributed tracing with OpenTelemetry for observability across microservices',
  tags: ['observability', 'tracing', 'monitoring', 'opentelemetry', 'distributed-tracing'],
  language: 'typescript',
  framework: 'Node.js',
  port: 3000,
  features: ['monitoring'],
  dependencies: {
    '@opentelemetry/api': '^1.7.0',
    '@opentelemetry/sdk-node': '^0.45.0',
    '@opentelemetry/auto-instrumentations': '^0.39.0',
    '@opentelemetry/exporter-trace-otlp-grpc': '^0.45.0',
    '@opentelemetry/exporter-metrics-otlp-grpc': '^0.45.0',
    '@opentelemetry/exporter-logs-otlp-grpc': '^0.45.0',
    '@opentelemetry/resources': '^1.18.0',
    '@opentelemetry/semantic-conventions': '^1.18.0',
    '@opentelemetry/instrumentation-express': '^0.33.0',
    '@opentelemetry/instrumentation-http': '^0.45.0',
    '@opentelemetry/instrumentation-grpc': '^0.45.0',
    '@opentelemetry/instrumentation-aws-lambda': '^0.38.0',
  },
  devDependencies: {
    '@types/node': '^20.11.0',
    'typescript': '^5.3.3',
  },

  files: {
    'src/tracing/index.ts': `import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { BatchMetricReader } from '@opentelemetry/sdk-metrics';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { ConsoleSpanExporter, ConsoleMetricExporter } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { InstrumentationOption } from '@opentelemetry/instrumentation';

export interface TracingConfig {
  serviceName: string;
  serviceVersion: string;
  deploymentEnvironment: string;
  otlpEndpoint?: string;
  consoleExport?: boolean;
  samplingRate?: number;
  instrumentations?: InstrumentationOption[];
}

export class TracingManager {
  private sdk: NodeSDK | null = null;

  async initialize(config: TracingConfig): Promise<void> {
    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.deploymentEnvironment,
      })
    );

    // Configure exporters
    const spanProcessors = [];

    if (config.consoleExport) {
      spanProcessors.push(
        new BatchSpanProcessor(new ConsoleSpanExporter())
      );
    }

    if (config.otlpEndpoint) {
      spanProcessors.push(
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: config.otlpEndpoint,
          })
        )
      );
    }

    const metricReaders = [];

    if (config.consoleExport) {
      metricReaders.push(
        new PeriodicExportingMetricReader({
          exporter: new ConsoleMetricExporter(),
        })
      );
    }

    if (config.otlpEndpoint) {
      metricReaders.push(
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            url: config.otlpEndpoint,
          }),
        })
      );
    }

    // Create SDK
    this.sdk = new NodeSDK({
      resource,
      traceExporter: spanProcessors.length > 0 ? undefined : undefined,
      spanProcessor: spanProcessors,
      metricReader: metricReaders,
      instrumentations: config.instrumentations || [
        '@opentelemetry/instrumentation-express',
        '@opentelemetry/instrumentation-http',
        '@opentelemetry/instrumentation-grpc',
      ],
      sampler: config.samplingRate !== undefined
        ? {
            sample: config.samplingRate,
          }
        : undefined,
    });

    // Start SDK
    this.sdk.start();

    console.log(\`✅ OpenTelemetry initialized for \${config.serviceName}\`);
    console.log(\`   Environment: \${config.deploymentEnvironment}\`);
    console.log(\`   Sampling: \${config.samplingRate || 1}\`);
  }

  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      console.log('OpenTelemetry shut down successfully');
    }
  }
}

// Singleton instance
let tracingManager: TracingManager | null = null;

export async function setupTracing(config: TracingConfig): Promise<TracingManager> {
  if (!tracingManager) {
    tracingManager = new TracingManager();
    await tracingManager.initialize(config);
  }
  return tracingManager;
}

export function getTracingManager(): TracingManager | null {
  return tracingManager;
}

export async function shutdownTracing(): Promise<void> {
  if (tracingManager) {
    await tracingManager.shutdown();
    tracingManager = null;
  }
}
`,
    'src/tracing/middleware.ts': `import { trace, Span, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import type { Request, Response, NextFunction } from 'express';

export interface TracedRequest extends Request {
  span?: Span;
}

/**
 * Express middleware for automatic HTTP request tracing
 */
export function tracingMiddleware(req: TracedRequest, res: Response, next: NextFunction): void {
  const tracer = trace.getTracer('express');
  const span = tracer.startSpan(\`\${req.method} \${req.path}\`, {
    kind: SpanKind.SERVER,
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.target': req.path,
      'http.host': req.get('host'),
      'http.scheme': req.protocol,
      'http.user_agent': req.get('user-agent') || '',
      'http.remote_addr': req.socket.remoteAddress || '',
      'http.request_content_length': req.get('content-length') || '0',
    },
  });

  req.span = span;

  // Record response status when response finishes
  res.on('finish', () => {
    span.setAttribute('http.status_code', res.statusCode);
    span.setStatus({
      code: res.statusCode >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
    });
    span.end();
  });

  next();
}

/**
 * Error handler middleware for tracing errors
 */
export function errorTracingMiddleware(
  err: Error,
  req: TracedRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.span) {
    req.span.recordException(err);
    req.span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err.message,
    });
  }
  next(err);
}

/**
 * Async hook wrapper for automatic tracing
 */
export function traceAsync<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    const tracer = trace.getTracer('async-hook');
    const span = tracer.startSpan(name);

    try {
      const result = await fn(...args);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  }) as T;
}
`,
    'src/tracing/decorators.ts': `import { trace, Span } from '@opentelemetry/api';

/**
 * Class method decorator for automatic tracing
 */
export function Traceable(spanName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tracer = trace.getTracer('class-method');
      const name = spanName || \`\${target.constructor.name}.\${propertyKey}\`;
      const span = tracer.startSpan(name, {
        attributes: {
          'code.function': propertyKey,
          'code.classname': target.constructor.name,
        },
      });

      try {
        const result = await originalMethod.apply(this, args);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    };

    return descriptor;
  };
}

/**
 * Function decorator for tracing
 */
export function TraceFunction(spanName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tracer = trace.getTracer('function');
      const name = spanName || propertyKey;
      const span = tracer.startSpan(name);

      try {
        const result = await originalMethod.apply(this, args);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    };

    return descriptor;
  };
}
`,
    'src/tracing/instrumentation.ts': `import { trace, Context, Span } from '@opentelemetry/api';

/**
 * Manual span creation utilities
 */
export class ManualTracer {
  startSpan(name: string, options?: { parent?: Span; attributes?: Record<string, any> }): Span {
    const tracer = trace.getTracer('manual');
    return tracer.startSpan(name, {
      root: !options?.parent,
      attributes: options?.attributes,
    });
  }

  setActiveSpan(span: Span): void {
    trace.setSpan(Context.active(), span);
  }

  addEvent(name: string, attributes?: Record<string, any>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  setAttribute(key: string, value: any): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute(key, value);
    }
  }

  recordException(error: Error): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
    }
  }
}

export const tracer = new ManualTracer();
`,
    'src/tracing/express.ts': `import { trace, Span } from '@opentelemetry/api';
import type { Router, RequestHandler } from 'express';

/**
 * Wraps an Express router with automatic tracing
 */
export function createTracedRouter(router: Router, routerName: string): void {
  const tracer = trace.getTracer('express-router');

  // @ts-ignore - Express internal stack
  router.stack.forEach((layer: any) => {
    if (layer.name === 'bound dispatch' && layer.handle) {
      const originalHandle = layer.handle;
      layer.handle = async (req: any, res: any, next: any) => {
        const span = trace.getActiveSpan();
        const childSpan = tracer.startSpan(\`\${routerName}.\${layer.name}\`, {
          parentSpan: span,
        });

        try {
          const result = await originalHandle(req, res, next);
          childSpan.end();
          return result;
        } catch (error) {
          childSpan.recordException(error as Error);
          childSpan.setStatus({ code: SpanStatusCode.ERROR });
          childSpan.end();
          throw error;
        }
      };
    }
  });
}

/**
 * Wraps individual route handlers with tracing
 */
export function traceRoute(handler: RequestHandler, routeName: string): RequestHandler {
  return async (req, res, next) => {
    const tracer = trace.getTracer('express-route');
    const span = tracer.startSpan(\`route.\${routeName}\`);

    try {
      const result = await handler(req, res, next);
      span.end();
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw error;
    }
  };
}
`,
    'src/tracing/database.ts': `import { trace, Span, Context, SpanContext } from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';

export interface DatabaseQueryOptions {
  query?: string;
  database?: string;
  collection?: string;
  operation?: string;
}

/**
 * Database query tracing utility
 */
export class DatabaseTracer {
  private tracer = trace.getTracer('database');

  traceQuery<T>(
    operation: string,
    fn: () => Promise<T>,
    options: DatabaseQueryOptions = {}
  ): Promise<T> {
    const span = this.tracer.startSpan(\`db.\${operation}\`, {
      attributes: {
        'db.system': options.database || 'unknown',
        'db.name': options.database || 'unknown',
        'db.operation': operation,
        'db.statement': options.query || '',
        'db.collection': options.collection || '',
      },
    });

    return this.tracer.withSpan(span, async () => {
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttribute('db.rows_affected', 1);
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  traceQueryAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    options: DatabaseQueryOptions = {}
  ): Promise<T> {
    return this.traceQuery(operation, fn, options);
  }
}

export const dbTracer = new DatabaseTracer();

/**
 * Usage examples:
 *
 * // MongoDB
 * const results = await dbTracer.traceQuery('find', async () => {
 *   return await User.find({ email });
 * }, { database: 'mydb', collection: 'users', query: 'SELECT * FROM users' });
 *
 * // PostgreSQL
 * const result = await dbTracer.traceQuery('execute', async () => {
 *   return await client.query('SELECT * FROM users');
 * }, { database: 'postgres', query: 'SELECT * FROM users' });
 */
`,
    'src/tracing/grpc.ts': `import { trace, Span, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import * as grpc from '@grpc/grpc-js';

/**
 * gRPC service interceptor for tracing
 */
export class GrpcTracer {
  private tracer = trace.getTracer('grpc');

  createInterceptor(methodName: string) {
    return (options: any, nextCall: any) => {
      const span = this.tracer.startSpan(\`grpc.\${methodName}\`, {
        kind: SpanKind.SERVER,
      });

      return new Promise((resolve, reject) => {
        const next = nextCall(options);

        next.on('data', (data: any) => {
          span.addEvent('grpc.message', {
            'grpc.message.type': 'RECEIVED',
          });
        });

        next.on('status', (status: any) => {
          span.setStatus({
            code: status.code === grpc.status.OK ? SpanStatusCode.OK : SpanStatusCode.ERROR,
            message: status.details,
          });
          span.setAttribute('grpc.status_code', status.code);
          span.end();
          resolve();
        });

        next.on('error', (error: any) => {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          span.end();
          reject(error);
        });
      });
    };
  }
}

export const grpcTracer = new GrpcTracer();
`,
    'src/tracing/async-local.ts': `/**
 * Async local storage for context propagation
 * Maintains trace context across async boundaries
 */

interface AsyncLocalStorage {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
  run<T>(callback: () => T): T;
}

class NodeAsyncLocalStorage implements AsyncLocalStorage {
  private storage = new Map<string, any>();

  get<T>(key: string): T | undefined {
    return this.storage.get(key);
  }

  set<T>(key: string, value: T): void {
    this.storage.set(key, value);
  }

  delete(key: string): void {
    this.storage.delete(key);
  }

  run<T>(callback: () => T): T {
    return callback();
  }
}

export const asyncLocalStorage: AsyncLocalStorage = new NodeAsyncLocalStorage();

/**
 * Context key for storing current trace ID
 */
export const TRACE_CONTEXT_KEY = 'opentelemetry_trace_context';

/**
 * Get current trace ID from async local storage
 */
export function getCurrentTraceId(): string | undefined {
  return asyncLocalStorage.get<string>(TRACE_CONTEXT_KEY);
}

/**
 * Set trace ID in async local storage
 */
export function setCurrentTraceId(traceId: string): void {
  asyncLocalStorage.set(TRACE_CONTEXT_KEY, traceId);
}
`,
    'src/index.ts': `import express, { Express, Request, Response } from 'express';
import { setupTracing, shutdownTracing } from './tracing';
import { tracingMiddleware, errorTracingMiddleware } from './tracing/middleware';
import { Traceable } from './tracing/decorators';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenTelemetry tracing
const tracingConfig = {
  serviceName: process.env.SERVICE_NAME || 'my-service',
  serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
  deploymentEnvironment: process.env.NODE_ENV || 'development',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
  consoleExport: process.env.CONSOLE_EXPORT === 'true',
  samplingRate: parseFloat(process.env.SAMPLING_RATE || '1.0'),
};

await setupTracing(tracingConfig);

// Middleware
app.use(tracingMiddleware);
app.use(express.json());

// Example routes
app.get('/', (req: any, res: Response) => {
  res.json({
    message: 'Hello from instrumented service!',
    traceId: req.span?.spanContext().traceId,
  });
});

app.get('/health', (req: any, res: Response) => {
  res.json({ status: 'healthy' });
});

// Example class with traced method
class UserService {
  @Traceable()
  async getUser(userId: string) {
    // Database query would be traced automatically
    return { id: userId, name: 'John Doe', email: 'john@example.com' };
  }
}

// Error handler
app.use(errorTracingMiddleware);

// Start server
const server = app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
  console.log(\`Service: \${tracingConfig.serviceName}\`);
  console.log(\`Tracing: \${tracingConfig.otlpEndpoint ? 'Enabled' : 'Console only'}\`);
});

// Graceful shutdown
async function shutdown() {
  console.log('\\nShutting down gracefully...');

  server.close(async () => {
    await shutdownTracing();
    console.log('Server shut down');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`,
    'package.json': `{
  "name": "{{name}}",
  "version": "1.0.0",
  "description": "OpenTelemetry distributed tracing demo",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "express": "^4.18.2",
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/sdk-node": "^0.45.0",
    "@opentelemetry/auto-instrumentations": "^0.39.0",
    "@opentelemetry/exporter-trace-otlp-grpc": "^0.45.0",
    "@opentelemetry/exporter-metrics-otlp-grpc": "^0.45.0",
    "@opentelemetry/exporter-logs-otlp-grpc": "^0.45.0",
    "@opentelemetry/resources": "^1.18.0",
    "@opentelemetry/semantic-conventions": "^1.18.0",
    "@opentelemetry/instrumentation-express": "^0.33.0",
    "@opentelemetry/instrumentation-http": "^0.45.0",
    "@grpc/grpc-js": "^1.9.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/express": "^4.17.21",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0"
  }
}
`,
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - SERVICE_NAME=my-service
      - SERVICE_VERSION=1.0.0
      - NODE_ENV=development
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
      - CONSOLE_EXPORT=true
      - SAMPLING_RATE=1.0
    depends_on:
      - otel-collector

  otel-collector:
    image: otel/opentelemetry-collector:0.90.0
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml:ro
    ports:
      - "4317:4317"   # OTLP gRPC receiver
      - "4318:4318"   # OTLP HTTP receiver
      - "9464:9464"   # Prometheus exporter

  jaeger:
    image: jaegertracing/all-in-one:1.50
    ports:
      - "5775:5775"   # Jaeger UI
      - "6831:6831"   # Jaeger collector
      - "6832:6832"   # Jaeger agent
    environment:
      - COLLECTOR_OTLP_ENABLED=true

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    volumes:
      - ./grafana-datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml:ro
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
`,
    'otel-collector-config.yaml': `receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    trace_export_timeout: 30s
    trace_export_retry_queue_size: 1000

exporters:
  jaeger:
    endpoint: jaeger:6831
    tls:
      insecure: true
  logging:
    logLevel: debug

  prometheus:
    endpoint: "0.0.0.0:9464"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [jaeger, logging]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus, logging]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [logging]
`,
    'prometheus.yml': `global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'otel-collector'
    static_configs:
      - targets: ['otel-collector:9464']
`,
    'grafana-datasources.yml': `apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true

  - name: Jaeger
    type: jaeger
    url: http://jaeger:16686
    editable: true
`,
    'Dockerfile': `FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/index.js"]
`,
    'README.md': `# OpenTelemetry Distributed Tracing

Complete distributed tracing implementation with OpenTelemetry for observability across microservices.

## Features

- **Automatic Instrumentation**: Express, HTTP, gRPC, AWS Lambda
- **Manual Tracing**: Utilities for custom spans and attributes
- **Context Propagation**: Trace context across async boundaries
- **Multiple Exporters**: Console, OTLP (Jaeger, Prometheus, Grafana)
- **Decorators**: TypeScript decorators for class methods and functions
- **Middleware**: Express middleware for automatic HTTP request tracing
- **Database Tracing**: Utilities for MongoDB, PostgreSQL, Redis, etc.

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Environment Variables

\`\`\`bash
SERVICE_NAME=my-service              # Service name
SERVICE_VERSION=1.0.0               # Service version
NODE_ENV=development               # Environment
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317  # OTLP endpoint
CONSOLE_EXPORT=true                # Enable console export
SAMPLING_RATE=1.0                  # Sampling rate (0-1)
\`\`\`

## Observability Stack

Docker Compose includes:
- **OpenTelemetry Collector**: Trace/metric/log collector
- **Jaeger**: Distributed tracing UI
- **Prometheus**: Metrics storage
- **Grafana**: Metrics visualization

Access:
- Jaeger UI: http://localhost:5775
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

## Usage Examples

### Express Middleware

\`\`\`typescript
import { tracingMiddleware } from './tracing/middleware';

app.use(tracingMiddleware);
// All HTTP requests are automatically traced
\`\`\`

### Class Decorator

\`\`\`typescript
import { Traceable } from './tracing/decorators';

class UserService {
  @Traceable()
  async getUser(userId: string) {
    // Method execution is automatically traced
  }
}
\`\`\`

### Manual Spans

\`\`\`typescript
import { tracer } from './tracing/instrumentation';

const span = tracer.startSpan('custom-operation');
// ... do work
span.setAttribute('key', 'value');
span.end();
\`\`\`

### Database Queries

\`\`\`typescript
import { dbTracer } from './tracing/database';

const users = await dbTracer.traceQuery('find', async () => {
  return await User.find({ email });
}, { database: 'mydb', collection: 'users' });
\`\`\`

## Trace Propagation

Traces automatically propagate across:
- HTTP requests (headers injected automatically)
- gRPC calls
- Async function calls
- Database queries

## Viewing Traces

1. Start the application: \`npm run dev\`
2. Start Docker Compose: \`docker-compose up -d\`
3. Make requests: \`curl http://localhost:3000\`
4. View traces in Jaeger: http://localhost:5775
5. View metrics in Grafana: http://localhost:3001

## Best Practices

1. **Sampling**: Use \`SAMPLING_RATE\` in production (default 1.0)
2. **Attributes**: Add meaningful attributes for filtering
3. **Span Events**: Record important events during operations
4. **Exceptions**: Always record exceptions for debugging
5. **Context**: Use decorators for automatic context propagation

## Integration

The tracing integrates seamlessly with:
- Express, Fastify, NestJS, Koa
- MongoDB, PostgreSQL, MySQL, Redis
- gRPC services
- AWS Lambda
- Custom frameworks

## Configuration

For production:
- Use OTLP exporter instead of console
- Set appropriate sampling rate
- Disable console export
- Use resource detection for Kubernetes/AWS

## License

MIT
`,
  },
};
