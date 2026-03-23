import { BackendTemplate } from '../types';

/**
 * Frontend Service Mesh Client Template
 * JavaScript/TypeScript SDK for seamless frontend-backend communication through service mesh
 */
export const frontendServiceMeshClientTemplate: BackendTemplate = {
  id: 'frontend-service-mesh-client',
  name: 'Frontend Service Mesh Client',
  displayName: 'Frontend-Backend Service Mesh Integration',
  description: 'Complete JavaScript/TypeScript SDK for frontend applications to communicate seamlessly with backend services through a service mesh (Istio, Linkerd, etc.) with automatic service discovery, circuit breaking, retry logic, load balancing, and request transformation',
  version: '1.0.0',
  language: 'typescript',
  framework: 'service-mesh',
  tags: ['service-mesh', 'frontend', 'integration', 'sdk', 'microservices'],
  port: 3000,
  dependencies: {},
  features: ['monitoring'],

  files: {
    'service-mesh-client/index.ts': `// Service Mesh Client SDK
// Frontend SDK for seamless backend communication through service mesh

import { ServiceMeshClient } from './client';
import { CircuitBreaker } from './circuit-breaker';
import { RetryPolicy } from './retry-policy';
import { ServiceDiscovery } from './service-discovery';
import { RequestTransformer } from './transformer';
import { LoadBalancer } from './load-balancer';

export {
  ServiceMeshClient,
  CircuitBreaker,
  RetryPolicy,
  ServiceDiscovery,
  RequestTransformer,
  LoadBalancer,
};

// Convenience export for default client
export const createServiceMeshClient = (config: ServiceMeshConfig) => {
  return new ServiceMeshClient(config);
};

export type {
  ServiceMeshConfig,
  ServiceRequest,
  ServiceResponse,
  ServiceEndpoint,
  CircuitBreakerConfig,
  RetryConfig,
  LoadBalancingStrategy,
};
`,

    'service-mesh-client/types.ts': `// Type definitions for Service Mesh Client

export interface ServiceMeshConfig {
  baseURL?: string;
  serviceMeshURL?: string; // Istio/Likerd control plane
  defaultTimeout?: number;
  enableCircuitBreaker?: boolean;
  enableRetry?: boolean;
  enableTracing?: boolean;
  enableMetrics?: boolean;
  circuitBreakerConfig?: CircuitBreakerConfig;
  retryConfig?: RetryConfig;
  loadBalancingStrategy?: LoadBalancingStrategy;
  transformRequest?: (request: ServiceRequest) => ServiceRequest;
  transformResponse?: (response: ServiceResponse) => ServiceResponse;
  onError?: (error: ServiceMeshError) => void;
  onRetry?: (attempt: number, error: ServiceMeshError) => void;
  onCircuitOpen?: (service: string) => void;
  onCircuitClose?: (service: string) => void;
}

export interface ServiceRequest {
  service: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retry?: boolean;
  circuitBreaker?: boolean;
  traceId?: string;
  correlationId?: string;
}

export interface ServiceResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  duration: number;
  retried?: boolean;
  circuitBreakerTripped?: boolean;
  serviceEndpoint?: string;
}

export interface ServiceEndpoint {
  service: string;
  url: string;
  healthy: boolean;
  lastCheck: number;
  responseTime: number;
  weight: number;
}

export interface ServiceMeshError extends Error {
  service?: string;
  code: string;
  status?: number;
  retried?: boolean;
  circuitBreakerOpen?: boolean;
  originalError?: Error;
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  monitoringPeriod: number;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
  retryableStatuses: number[];
}

export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'ROUND_ROBIN',
  LEAST_CONNECTIONS = 'LEAST_CONNECTIONS',
  WEIGHTED = 'WEIGHTED',
  RANDOM = 'RANDOM',
  IP_HASH = 'IP_HASH',
}
`,

    'service-mesh-client/client.ts': `// Service Mesh Client
// Main client for frontend-backend communication through service mesh

import { fetch } from 'whatwg-fetch';
import { ServiceDiscovery } from './service-discovery';
import { CircuitBreaker } from './circuit-breaker';
import { RetryPolicy } from './retry-policy';
import { LoadBalancer } from './load-balancer';
import { RequestTransformer } from './transformer';
import {
  ServiceMeshConfig,
  ServiceRequest,
  ServiceResponse,
  ServiceMeshError,
  ServiceEndpoint,
} from './types';

export class ServiceMeshClient {
  private config: Required<ServiceMeshConfig>;
  private serviceDiscovery: ServiceDiscovery;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private retryPolicy: RetryPolicy;
  private loadBalancer: LoadBalancer;
  private requestTransformer: RequestTransformer;
  private metrics: Map<string, any>;

  constructor(config: ServiceMeshConfig) {
    this.config = {
      baseURL: config.baseURL || '',
      serviceMeshURL: config.serviceMeshURL || '',
      defaultTimeout: config.defaultTimeout || 30000,
      enableCircuitBreaker: config.enableCircuitBreaker !== false,
      enableRetry: config.enableRetry !== false,
      enableTracing: config.enableTracing !== false,
      enableMetrics: config.enableMetrics !== false,
      circuitBreakerConfig: config.circuitBreakerConfig || {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
        monitoringPeriod: 10000,
      },
      retryConfig: config.retryConfig || {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        retryableErrors: ['NETWORK_ERROR', 'TIMEOUT'],
        retryableStatuses: [408, 429, 500, 502, 503, 504],
      },
      loadBalancingStrategy: config.loadBalancingStrategy || 'ROUND_ROBIN' as any,
      transformRequest: config.transformRequest || ((r) => r),
      transformResponse: config.transformResponse || ((r) => r),
      onError: config.onError || (() => {}),
      onRetry: config.onRetry || (() => {}),
      onCircuitOpen: config.onCircuitOpen || (() => {}),
      onCircuitClose: config.onCircuitClose || (() => {}),
    };

    this.serviceDiscovery = new ServiceDiscovery(this.config);
    this.circuitBreakers = new Map();
    this.retryPolicy = new RetryPolicy(this.config);
    this.loadBalancer = new LoadBalancer(this.config);
    this.requestTransformer = new RequestTransformer(this.config);
    this.metrics = new Map();
  }

  /**
   * Make a request to a backend service
   */
  async request<T = any>(request: ServiceRequest): Promise<ServiceResponse<T>> {
    const startTime = Date.now();
    let endpoint: ServiceEndpoint | undefined;

    try {
      // Transform request
      request = this.requestTransformer.transform(request);

      // Discover service endpoint
      endpoint = await this.serviceDiscovery.discover(request.service);

      if (!endpoint || !endpoint.healthy) {
        throw new ServiceMeshError(
          \`No healthy endpoint available for service: \${request.service}\`,
          'NO_ENDPOINT'
        );
      }

      // Check circuit breaker
      if (this.config.enableCircuitBreaker) {
        const circuitBreaker = this.getCircuitBreaker(request.service);
        if (circuitBreaker.isOpen()) {
          const error = new ServiceMeshError(
            \`Circuit breaker is open for service: \${request.service}\`,
            'CIRCUIT_BREAKER_OPEN'
          );
          error.circuitBreakerOpen = true;
          throw error;
        }
      }

      // Build request URL
      const url = this.buildURL(endpoint.url, request.path, request.params);

      // Build request options
      const options: RequestInit = {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          ...request.headers,
          // Add tracing headers
          ...(this.config.enableTracing && {
            'x-trace-id': request.traceId || this.generateTraceId(),
            'x-correlation-id': request.correlationId || this.generateCorrelationId(),
          }),
        },
        body: request.data ? JSON.stringify(request.data) : undefined,
      };

      // Execute with retry
      const executeWithRetry = async (): Promise<ServiceResponse<T>> => {
        const executeRequest = async (): Promise<ServiceResponse<T>> => {
          const response = await fetch(url, options);
          const data = await response.json().catch(() => response.text());
          const duration = Date.now() - startTime;

          return {
            data,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            duration,
            serviceEndpoint: endpoint?.url,
          };
        };

        if (this.config.enableRetry && request.retry !== false) {
          return this.retryPolicy.execute(request.service, executeRequest);
        }

        return executeRequest();
      };

      const response = await executeWithRetry();

      // Record success
      if (this.config.enableCircuitBreaker) {
        const circuitBreaker = this.getCircuitBreaker(request.service);
        circuitBreaker.recordSuccess();
      }

      // Transform response
      const transformedResponse = this.config.transformResponse(response);

      // Record metrics
      if (this.config.enableMetrics) {
        this.recordMetrics(request.service, response);
      }

      return transformedResponse;
    } catch (error) {
      // Record failure
      if (this.config.enableCircuitBreaker && endpoint) {
        const circuitBreaker = this.getCircuitBreaker(request.service);
        circuitBreaker.recordFailure();
      }

      // Handle error
      const serviceMeshError = this.handleError(error, request, endpoint);
      this.config.onError(serviceMeshError);
      throw serviceMeshError;
    }
  }

  /**
   * Convenience method for GET requests
   */
  async get<T = any>(
    service: string,
    path: string,
    params?: Record<string, any>
  ): Promise<ServiceResponse<T>> {
    return this.request<T>({ service, method: 'GET', path, params });
  }

  /**
   * Convenience method for POST requests
   */
  async post<T = any>(
    service: string,
    path: string,
    data?: any
  ): Promise<ServiceResponse<T>> {
    return this.request<T>({ service, method: 'POST', path, data });
  }

  /**
   * Convenience method for PUT requests
   */
  async put<T = any>(
    service: string,
    path: string,
    data?: any
  ): Promise<ServiceResponse<T>> {
    return this.request<T>({ service, method: 'PUT', path, data });
  }

  /**
   * Convenience method for PATCH requests
   */
  async patch<T = any>(
    service: string,
    path: string,
    data?: any
  ): Promise<ServiceResponse<T>> {
    return this.request<T>({ service, method: 'PATCH', path, data });
  }

  /**
   * Convenience method for DELETE requests
   */
  async delete<T = any>(
    service: string,
    path: string
  ): Promise<ServiceResponse<T>> {
    return this.request<T>({ service, method: 'DELETE', path });
  }

  /**
   * Get metrics for a service
   */
  getMetrics(service?: string): any {
    if (service) {
      return this.metrics.get(service);
    }
    return Object.fromEntries(this.metrics.entries());
  }

  /**
   * Reset circuit breaker for a service
   */
  resetCircuitBreaker(service: string): void {
    const circuitBreaker = this.circuitBreakers.get(service);
    if (circuitBreaker) {
      circuitBreaker.reset();
    }
  }

  /**
   * Build URL with params
   */
  private buildURL(
    baseURL: string,
    path: string,
    params?: Record<string, any>
  ): string {
    const url = new URL(path, baseURL);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    return url.toString();
  }

  /**
   * Get circuit breaker for service
   */
  private getCircuitBreaker(service: string): CircuitBreaker {
    if (!this.circuitBreakers.has(service)) {
      const circuitBreaker = new CircuitBreaker(
        service,
        this.config.circuitBreakerConfig
      );
      circuitBreaker.onOpen(() => this.config.onCircuitOpen(service));
      circuitBreaker.onClose(() => this.config.onCircuitClose(service));
      this.circuitBreakers.set(service, circuitBreaker);
    }
    return this.circuitBreakers.get(service)!;
  }

  /**
   * Record metrics
   */
  private recordMetrics(service: string, response: ServiceResponse): void {
    const metrics = this.metrics.get(service) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      responseTimes: [],
    };

    metrics.totalRequests++;
    if (response.status >= 200 && response.status < 300) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    metrics.totalResponseTime += response.duration;
    metrics.avgResponseTime = metrics.totalResponseTime / metrics.totalRequests;

    metrics.responseTimes.push(response.duration);
    if (metrics.responseTimes.length > 1000) {
      metrics.responseTimes.shift();
    }

    // Calculate percentiles
    const sorted = [...metrics.responseTimes].sort((a, b) => a - b);
    metrics.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)] || 0;
    metrics.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)] || 0;

    this.metrics.set(service, metrics);
  }

  /**
   * Handle error
   */
  private handleError(
    error: any,
    request: ServiceRequest,
    endpoint?: ServiceEndpoint
  ): ServiceMeshError {
    const serviceMeshError = new ServiceMeshError(
      error.message || 'Unknown error',
      error.code || 'UNKNOWN_ERROR'
    ) as any;
    serviceMeshError.service = request.service;
    serviceMeshError.status = error.status;
    serviceMeshError.originalError = error;

    if (endpoint) {
      serviceMeshError.serviceEndpoint = endpoint.url;
    }

    return serviceMeshError;
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return \`trace-\${Date.now()}-\${Math.random().toString(36).substring(2, 15)}\`;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return \`crid-\${Date.now()}-\${Math.random().toString(36).substring(2, 15)}\`;
  }
}
`,

    'service-mesh-client/circuit-breaker.ts': `// Circuit Breaker Implementation
// Prevents cascading failures by stopping requests to failing services

import { CircuitBreakerConfig, CircuitBreakerState } from './types';

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private openedAt = 0;
  private onOpenCallback?: () => void;
  private onCloseCallback?: () => void;

  constructor(
    private service: string,
    private config: CircuitBreakerConfig
  ) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error(\`Circuit breaker is open for service: \${this.service}\`);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record successful call
   */
  recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        this.close();
      }
    }
  }

  /**
   * Record failed call
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.CLOSED) {
      if (this.failureCount >= this.config.failureThreshold) {
        this.open();
      }
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.open();
    }
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    if (this.state === CircuitBreakerState.OPEN) {
      // Check if timeout has elapsed
      if (Date.now() - this.openedAt >= this.config.timeout) {
        this.halfOpen();
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Open the circuit
   */
  private open(): void {
    this.state = CircuitBreakerState.OPEN;
    this.openedAt = Date.now();
    if (this.onOpenCallback) {
      this.onOpenCallback();
    }
  }

  /**
   * Close the circuit
   */
  private close(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.successCount = 0;
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  /**
   * Half-open the circuit
   */
  private halfOpen(): void {
    this.state = CircuitBreakerState.HALF_OPEN;
    this.successCount = 0;
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.openedAt = 0;
  }

  /**
   * Get circuit state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Register callback for circuit open
   */
  onOpen(callback: () => void): void {
    this.onOpenCallback = callback;
  }

  /**
   * Register callback for circuit close
   */
  onClose(callback: () => void): void {
    this.onCloseCallback = callback;
  }
}
`,

    'service-mesh-client/retry-policy.ts': `// Retry Policy Implementation
// Automatic retry with exponential backoff for failed requests

import { RetryConfig, ServiceMeshError } from './types';

export class RetryPolicy {
  private retryCount = new Map<string, number>();

  constructor(private config: RetryConfig) {}

  /**
   * Execute function with retry logic
   */
  async execute<T>(service: string, fn: () => Promise<T>): Promise<T> {
    let lastError: any;
    let delay = this.config.initialDelay;

    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      try {
        const result = await fn();
        this.retryCount.delete(service);
        return result;
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.isRetryable(error)) {
          throw error;
        }

        // Don't delay after last attempt
        if (attempt < this.config.maxAttempts - 1) {
          await this.delay(delay);
          delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxDelay);

          // Notify retry
          if (this.config.onRetry) {
            this.config.onRetry(attempt + 1, error);
          }
        }
      }
    }

    // All retries exhausted
    const serviceMeshError = new ServiceMeshError(
      \`Max retries (\${this.config.maxAttempts}) exceeded\`,
      'MAX_RETRIES_EXCEEDED'
    ) as any;
    serviceMeshError.retried = true;
    serviceMeshError.originalError = lastError;
    throw serviceMeshError;
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: any): boolean {
    // Check error code
    const code = error.code || error.name;
    if (this.config.retryableErrors.includes(code)) {
      return true;
    }

    // Check HTTP status
    const status = error.status;
    if (status && this.config.retryableStatuses.includes(status)) {
      return true;
    }

    return false;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
`,

    'service-mesh-client/service-discovery.ts': `// Service Discovery Implementation
// Discover and track healthy service endpoints

import { ServiceEndpoint } from './types';

export class ServiceDiscovery {
  private endpoints: Map<string, ServiceEndpoint[]> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(private config: any) {
    // Start health checks if service mesh URL is provided
    if (config.serviceMeshURL) {
      this.startHealthChecks();
    }
  }

  /**
   * Discover service endpoint
   */
  async discover(service: string): Promise<ServiceEndpoint | undefined> {
    const endpoints = this.endpoints.get(service);

    if (!endpoints || endpoints.length === 0) {
      // Try to discover from service mesh
      await this.discoverFromServiceMesh(service);
      return this.endpoints.get(service)?.[0];
    }

    // Return first healthy endpoint
    return endpoints.find(e => e.healthy);
  }

  /**
   * Get all endpoints for a service
   */
  async getAllEndpoints(service: string): Promise<ServiceEndpoint[]> {
    const endpoints = this.endpoints.get(service);

    if (!endpoints) {
      await this.discoverFromServiceMesh(service);
      return this.endpoints.get(service) || [];
    }

    return endpoints;
  }

  /**
   * Discover from service mesh control plane
   */
  private async discoverFromServiceMesh(service: string): Promise<void> {
    if (!this.config.serviceMeshURL) {
      // Use default service URL
      const defaultEndpoint: ServiceEndpoint = {
        service,
        url: \`http://\${service}\`,
        healthy: true,
        lastCheck: Date.now(),
        responseTime: 0,
        weight: 1,
      };

      this.endpoints.set(service, [defaultEndpoint]);
      return;
    }

    try {
      // Query Istio/Likerd service registry
      const response = await fetch(\`\${this.config.serviceMeshURL}/v1/services/\${service}\`);
      const services = await response.json();

      const endpoints: ServiceEndpoint[] = services.map((s: any) => ({
        service,
        url: s.url,
        healthy: s.healthy !== false,
        lastCheck: Date.now(),
        responseTime: 0,
        weight: s.weight || 1,
      }));

      this.endpoints.set(service, endpoints);
    } catch (error) {
      console.warn(\`Failed to discover service \${service} from service mesh:\`, error);
    }
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [service, endpoints] of this.endpoints.entries()) {
        for (const endpoint of endpoints) {
          await this.checkHealth(endpoint);
        }
      }
    }, this.config.circuitBreakerConfig?.monitoringPeriod || 10000);
  }

  /**
   * Check endpoint health
   */
  private async checkHealth(endpoint: ServiceEndpoint): Promise<void> {
    try {
      const start = Date.now();
      const response = await fetch(\`\${endpoint.url}/health\`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const duration = Date.now() - start;

      endpoint.healthy = response.ok;
      endpoint.lastCheck = Date.now();
      endpoint.responseTime = duration;
    } catch (error) {
      endpoint.healthy = false;
      endpoint.lastCheck = Date.now();
    }
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}
`,

    'service-mesh-client/load-balancer.ts': `// Load Balancer Implementation
// Distribute requests across multiple service endpoints

import { LoadBalancingStrategy, ServiceEndpoint } from './types';

export class LoadBalancer {
  private roundRobinIndex = new Map<string, number>();

  constructor(private strategy: LoadBalancingStrategy) {}

  /**
   * Select endpoint based on load balancing strategy
   */
  select(
    service: string,
    endpoints: ServiceEndpoint[]
  ): ServiceEndpoint | undefined {
    const healthyEndpoints = endpoints.filter(e => e.healthy);

    if (healthyEndpoints.length === 0) {
      return undefined;
    }

    if (healthyEndpoints.length === 1) {
      return healthyEndpoints[0];
    }

    switch (this.strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this.roundRobin(service, healthyEndpoints);
      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        return this.leastConnections(healthyEndpoints);
      case LoadBalancingStrategy.WEIGHTED:
        return this.weighted(healthyEndpoints);
      case LoadBalancingStrategy.RANDOM:
        return this.random(healthyEndpoints);
      case LoadBalancingStrategy.IP_HASH:
        return this.ipHash(service, healthyEndpoints);
      default:
        return healthyEndpoints[0];
    }
  }

  /**
   * Round-robin load balancing
   */
  private roundRobin(
    service: string,
    endpoints: ServiceEndpoint[]
  ): ServiceEndpoint {
    let index = this.roundRobinIndex.get(service) || 0;
    const endpoint = endpoints[index % endpoints.length];
    index++;
    this.roundRobinIndex.set(service, index);
    return endpoint;
  }

  /**
   * Least connections load balancing
   */
  private leastConnections(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    // Sort by response time (proxy for active connections)
    return endpoints.sort((a, b) => a.responseTime - b.responseTime)[0];
  }

  /**
   * Weighted load balancing
   */
  private weighted(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;

    for (const endpoint of endpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        return endpoint;
      }
    }

    return endpoints[0];
  }

  /**
   * Random load balancing
   */
  private random(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    const index = Math.floor(Math.random() * endpoints.length);
    return endpoints[index];
  }

  /**
   * IP hash load balancing
   */
  private ipHash(
    clientIP: string,
    endpoints: ServiceEndpoint[]
  ): ServiceEndpoint {
    // Simple hash implementation
    let hash = 0;
    for (let i = 0; i < clientIP.length; i++) {
      hash = ((hash << 5) - hash) + clientIP.charCodeAt(i);
      hash = hash & hash;
    }

    const index = Math.abs(hash) % endpoints.length;
    return endpoints[index];
  }
}
`,

    'service-mesh-client/transformer.ts': `// Request/Response Transformer
// Transform requests and responses before sending/after receiving

import { ServiceRequest, ServiceResponse } from './types';

export class RequestTransformer {
  constructor(private config: any) {}

  /**
   * Transform request before sending
   */
  transform(request: ServiceRequest): ServiceRequest {
    let transformed = { ...request };

    // Apply global transform
    if (this.config.transformRequest) {
      transformed = this.config.transformRequest(transformed);
    }

    // Add service mesh headers
    transformed.headers = {
      ...transformed.headers,
      'x-service-mesh': 'enabled',
      'x-service-name': request.service,
      'x-forwarded-for': this.getClientIP(),
    };

    return transformed;
  }

  /**
   * Transform response after receiving
   */
  transformResponse<T>(response: ServiceResponse<T>): ServiceResponse<T> {
    // Apply global transform
    if (this.config.transformResponse) {
      return this.config.transformResponse(response);
    }

    return response;
  }

  /**
   * Get client IP
   */
  private getClientIP(): string {
    // In browser, this won't be available
    // In Node.js, you can get it from the request
    return 'unknown';
  }
}
`,

    'service-mesh-client/README.md': `# Service Mesh Client SDK

Frontend SDK for seamless communication with backend services through a service mesh (Istio, Linkerd, etc.).

## Features

- **Automatic Service Discovery**: Discover and track healthy service endpoints
- **Circuit Breaking**: Prevent cascading failures by stopping requests to failing services
- **Retry Logic**: Automatic retry with exponential backoff for transient failures
- **Load Balancing**: Distribute requests across multiple endpoints (round-robin, least-connections, weighted, random, IP hash)
- **Request Transformation**: Transform requests and responses before sending/after receiving
- **Metrics Collection**: Track request metrics (success rate, response time, percentiles)
- **OpenTelemetry Integration**: Automatic trace and correlation ID propagation

## Installation

\`\`\`bash
npm install @re-shell/service-mesh-client
\`\`\`

## Quick Start

\`\`\`typescript
import { createServiceMeshClient } from '@re-shell/service-mesh-client';

const client = createServiceMeshClient({
  baseURL: 'https://api.example.com',
  serviceMeshURL: 'https://istio.istio-system.svc.cluster.local',
  enableCircuitBreaker: true,
  enableRetry: true,
  enableTracing: true,
});

// Make requests
const users = await client.get('user-service', '/api/users');
const user = await client.get('user-service', '/api/users/123');

const newUser = await client.post('user-service', '/api/users', {
  name: 'John Doe',
  email: 'john@example.com',
});
\`\`\`

## API Reference

### createServiceMeshClient(config)

Create a new service mesh client instance.

#### Configuration

\`\`\`typescript
interface ServiceMeshConfig {
  baseURL?: string;              // Base URL for API requests
  serviceMeshURL?: string;        // Service mesh control plane URL
  defaultTimeout?: number;        // Request timeout in ms
  enableCircuitBreaker?: boolean; // Enable circuit breaker
  enableRetry?: boolean;          // Enable retry logic
  enableTracing?: boolean;        // Enable distributed tracing
  enableMetrics?: boolean;        // Enable metrics collection
  circuitBreakerConfig?: CircuitBreakerConfig;
  retryConfig?: RetryConfig;
  loadBalancingStrategy?: LoadBalancingStrategy;
}
\`\`\`

### Methods

#### client.get(service, path, params?)

Make a GET request.

\`\`\`typescript
const response = await client.get('user-service', '/api/users', { page: 1 });
\`\`\`

#### client.post(service, path, data?)

Make a POST request.

\`\`\`typescript
const response = await client.post('user-service', '/api/users', {
  name: 'John Doe',
});
\`\`\`

#### client.put(service, path, data?)

Make a PUT request.

\`\`\`typescript
const response = await client.put('user-service', '/api/users/123', {
  name: 'Jane Doe',
});
\`\`\`

#### client.patch(service, path, data?)

Make a PATCH request.

\`\`\`typescript
const response = await client.patch('user-service', '/api/users/123', {
  name: 'Jane Doe',
});
\`\`\`

#### client.delete(service, path)

Make a DELETE request.

\`\`\`typescript
await client.delete('user-service', '/api/users/123');
\`\`\`

#### client.request(request)

Make a custom request.

\`\`\`typescript
const response = await client.request({
  service: 'user-service',
  method: 'GET',
  path: '/api/users',
  params: { page: 1 },
  headers: { 'x-custom-header': 'value' },
  timeout: 5000,
});
\`\`\`

## Integration with Frontend Frameworks

### React

\`\`\`typescript
import { createServiceMeshClient } from '@re-shell/service-mesh-client';
import { useEffect, useState } from 'react';

const client = createServiceMeshClient({
  baseURL: process.env.REACT_APP_API_URL,
});

function UsersList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      try {
        const response = await client.get('user-service', '/api/users');
        setUsers(response.data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
\`\`\`

### Vue

\`\`\`typescript
import { createServiceMeshClient } from '@re-shell/service-mesh-client';
import { ref, onMounted } from 'vue';

const client = createServiceMeshClient({
  baseURL: import.meta.env.VITE_API_URL,
});

export function useUsers() {
  const users = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function fetchUsers() {
    loading.value = true;
    try {
      const response = await client.get('user-service', '/api/users');
      users.value = response.data;
    } catch (err) {
      error.value = err;
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    fetchUsers();
  });

  return { users, loading, error, fetchUsers };
}
\`\`\`

## License

MIT
`,

    'package.json': `{
  "name": "service-mesh-client",
  "version": "1.0.0",
  "description": "Frontend SDK for service mesh communication",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "keywords": [
    "service-mesh",
    "frontend",
    "sdk",
    "microservices",
    "istio",
    "linkerd"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "whatwg-fetch": "^3.6.2"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  }
}
`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true
  },
  "include": ["service-mesh-client/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
`,
  },
};
