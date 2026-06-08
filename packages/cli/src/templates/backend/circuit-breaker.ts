import { BackendTemplate } from '../types';

/**
 * Circuit Breaker Pattern Template
 * Resilient service communication with circuit breakers, retries, and fallbacks
 */
export const circuitBreakerTemplate: BackendTemplate = {
  id: 'circuit-breaker',
  name: 'Circuit Breaker Patterns',
  displayName: 'Resilience & Circuit Breakers',
  description: 'Complete circuit breaker implementation with retry policies, rate limiting, bulkheads, timeouts, and fallback mechanisms for resilient microservices',
  version: '1.0.0',
  language: 'typescript',
  framework: 'resilience',
  tags: ['kubernetes', 'resilience', 'circuit-breaker', 'retry', 'rate-limit', 'timeout'],
  port: 3000,
  dependencies: {},
  features: ['monitoring', 'rate-limiting', 'security', 'documentation'],

  files: {
    'circuit-breaker/circuit-breaker.ts': `// Circuit Breaker Implementation
// Prevents cascading failures by stopping requests to failing services

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  openedAt?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private openedAt?: number;
  private halfOpenCalls = 0;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig,
  ) {}

  async execute<T>(fn: () => Promise<T>, fallback?: () => T | Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        if (fallback) {
          return fallback();
        }
        throw new Error(\`Circuit breaker '\${this.name}' is OPEN\`);
      }
    }

    if (this.state === CircuitState.HALF_OPEN && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      if (fallback) {
        return fallback();
      }
      throw new Error(\`Circuit breaker '\${this.name}' is HALF_OPEN and max calls exceeded\`);
    }

    try {
      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenCalls++;
      }

      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.halfOpenCalls = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;
    this.lastFailureTime = Date.now();

    if (
      this.state === CircuitState.CLOSED &&
      this.failureCount >= this.config.failureThreshold
    ) {
      this.transitionTo(CircuitState.OPEN);
    } else if (
      this.state === CircuitState.HALF_OPEN ||
      (this.state === CircuitState.HALF_OPEN && this.failureCount > 0)
    ) {
      this.transitionTo(CircuitState.OPEN);
      this.halfOpenCalls = 0;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.openedAt) return false;
    return Date.now() - this.openedAt > this.config.timeout;
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.openedAt = Date.now();
    }

    console.log(\`Circuit breaker '\${this.name}' transitioned from \${oldState} to \${newState}\`);
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      openedAt: this.openedAt,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.openedAt = undefined;
    this.halfOpenCalls = 0;
  }
}
`,

    'circuit-breaker/retry-policy.ts': `// Retry Policy Implementation
// Automatic retries with exponential backoff and jitter

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors?: (error: any) => boolean;
}

export class RetryPolicy {
  constructor(private readonly config: RetryConfig) {}

  async execute<T>(fn: (attempt: number) => Promise<T>): Promise<T> {
    let lastError: any;
    let delay = this.config.initialDelay;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await fn(attempt);
      } catch (error) {
        lastError = error;

        const isRetryable = this.config.retryableErrors
          ? this.config.retryableErrors(error)
          : this.isDefaultRetryable(error);

        if (!isRetryable || attempt === this.config.maxAttempts) {
          throw error;
        }

        const actualDelay = this.config.jitter
          ? this.addJitter(delay)
          : delay;

        console.log(\`Retry attempt \${attempt + 1}/\${this.config.maxAttempts} after \${actualDelay}ms\`);
        await this.sleep(actualDelay);

        delay = Math.min(
          delay * this.config.backoffMultiplier,
          this.config.maxDelay
        );
      }
    }

    throw lastError;
  }

  private isDefaultRetryable(error: any): boolean {
    if (error?.code === 'ECONNRESET') return true;
    if (error?.code === 'ETIMEDOUT') return true;
    if (error?.code === 'ENOTFOUND') return true;
    if (error?.code === 'ECONNREFUSED') return true;
    if (error?.status >= 500) return true;
    if (error?.status === 429) return true;
    if (error?.statusCode >= 500) return true;
    if (error?.statusCode === 429) return true;
    return false;
  }

  private addJitter(delay: number): number {
    return delay + Math.random() * delay * 0.1;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Predefined retry strategies
export const RetryStrategies = {
  exponential: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
  },
  linear: {
    maxAttempts: 5,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 1,
    jitter: false,
  },
  aggressive: {
    maxAttempts: 10,
    initialDelay: 100,
    maxDelay: 5000,
    backoffMultiplier: 1.5,
    jitter: true,
  },
};
`,

    'circuit-breaker/timeout.ts': `// Timeout Implementation
// Aborts long-running requests after specified duration

export class TimeoutError extends Error {
  constructor(message: string, public readonly timeout: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class Timeout {
  constructor(private readonly duration: number) {}

  async execute<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.duration);

    try {
      return await fn(controller.signal);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(\`Operation timed out after \${this.duration}ms\`, this.duration);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static from(ms: number): Timeout {
    return new Timeout(ms);
  }
}

// Predefined timeouts
export const TimeoutPresets = {
  fast: 1000,
  normal: 5000,
  slow: 10000,
  verySlow: 30000,
};
`,

    'circuit-breaker/rate-limiter.ts': `// Rate Limiter Implementation
// Token bucket and sliding window rate limiting

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private requests: number[] = [];

  constructor(private readonly config: RateLimitConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkLimit();
    this.recordRequest();
    return fn();
  }

  private checkLimit(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    this.requests = this.requests.filter(time => time > windowStart);

    if (this.requests.length >= this.config.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + this.config.windowMs - now;
      throw new Error(\`Rate limit exceeded. Try again in \${waitTime}ms\`);
    }
  }

  private recordRequest(): void {
    this.requests.push(Date.now());
  }

  getStats(): { count: number; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const validRequests = this.requests.filter(time => time > windowStart);

    return {
      count: validRequests.length,
      remaining: Math.max(0, this.config.maxRequests - validRequests.length),
      resetTime: this.requests[0] + this.config.windowMs,
    };
  }

  reset(): void {
    this.requests = [];
  }
}

// Token Bucket Rate Limiter
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill = Date.now();

  constructor(
    private readonly capacity: number,
    private readonly refillRate: number, // tokens per second
  ) {
    this.tokens = capacity;
  }

  async execute<T>(cost: number, fn: () => Promise<T>): Promise<T> {
    this.refill();

    if (this.tokens < cost) {
      throw new Error(\`Not enough tokens. Available: \${this.tokens}, Required: \${cost}\`);
    }

    this.tokens -= cost;
    return fn();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  waitForToken(cost: number): number {
    this.refill();

    if (this.tokens >= cost) {
      return 0;
    }

    const tokensNeeded = cost - this.tokens;
    const waitTime = (tokensNeeded / this.refillRate) * 1000;

    return Math.ceil(waitTime);
  }
}
`,

    'circuit-breaker/bulkhead.ts': `// Bulkhead Pattern Implementation
// Limits concurrent resources to prevent resource exhaustion

export class BulkheadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkheadError';
  }
}

export interface BulkheadConfig {
  maxConcurrent: number;
  maxQueueSize: number;
}

export class Bulkhead {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly config: BulkheadConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          this.running++;
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      };

      if (this.running < this.config.maxConcurrent) {
        task();
      } else if (this.queue.length < this.config.maxQueueSize) {
        this.queue.push(task);
      } else {
        reject(new BulkheadError('Bulkhead queue is full'));
      }
    });
  }

  private processQueue(): void {
    while (this.queue.length > 0 && this.running < this.config.maxConcurrent) {
      const task = this.queue.shift();
      if (task) task();
    }
  }

  getStats(): { running: number; queued: number } {
    return {
      running: this.running,
      queued: this.queue.length,
    };
  }
}
`,

    'circuit-breaker/resilience-pipeline.ts': `// Resilience Pipeline
// Combines multiple resilience patterns into a cohesive pipeline

import { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker';
import { RetryPolicy, RetryConfig } from './retry-policy';
import { Timeout } from './timeout';
import { Bulkhead, BulkheadConfig } from './bulkhead';

export interface ResiliencePipelineConfig {
  circuitBreaker?: CircuitBreakerConfig;
  retry?: RetryConfig;
  timeout?: number;
  bulkhead?: BulkheadConfig;
  fallback?: () => any;
}

export class ResiliencePipeline {
  private circuitBreaker?: CircuitBreaker;
  private retry?: RetryPolicy;
  private timeout?: Timeout;
  private bulkhead?: Bulkhead;

  constructor(
    private readonly name: string,
    config: ResiliencePipelineConfig = {},
  ) {
    if (config.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(name, config.circuitBreaker);
    }
    if (config.retry) {
      this.retry = new RetryPolicy(config.retry);
    }
    if (config.timeout) {
      this.timeout = new Timeout(config.timeout);
    }
    if (config.bulkhead) {
      this.bulkhead = new Bulkhead(config.bulkhead);
    }
  }

  async execute<T>(fn: () => Promise<T>, fallback?: () => T | Promise<T>): Promise<T> {
    let wrappedFn = fn;

    if (this.bulkhead) {
      const originalFn = wrappedFn;
      wrappedFn = () => this.bulkhead!.execute(originalFn);
    }

    if (this.circuitBreaker) {
      const originalFn = wrappedFn;
      wrappedFn = () => this.circuitBreaker!.execute(originalFn, fallback);
    }

    if (this.retry) {
      const originalFn = wrappedFn;
      wrappedFn = (attempt) => this.retry!.execute(() => originalFn());
    }

    if (this.timeout) {
      const originalFn = wrappedFn;
      wrappedFn = (signal) => this.timeout!.execute((sig) => originalFn(sig));
    }

    return wrappedFn() as Promise<T>;
  }

  getStats() {
    return {
      circuitBreaker: this.circuitBreaker?.getStats(),
      bulkhead: this.bulkhead?.getStats(),
    };
  }
}
`,

    'istio/circuit-breaker.yaml': `# Istio Circuit Breaker Configuration
# DestinationRule with connection pool and outlier detection

apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: product-service-circuit-breaker
spec:
  host: product-service
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        http2MaxRequests: 100
        maxRequestsPerConnection: 5
        maxRetries: 3
        idleTimeout: 300s
        h2UpgradePolicy: UPGRADE
    outlierDetection:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
      minHealthPercent: 40
      analyzingInterval: 10s
    loadBalancer:
      simple: LEAST_CONN
      localityLbSetting:
        enabled: true
        failover:
          - from: region1
            to: region2

---
# Timeout Configuration
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: product-service-timeout
spec:
  hosts:
    - product-service
  http:
    - match:
        - uri:
            prefix: /api/products
      timeout: 5s
      retryPolicy:
        attempts: 3
        perTryTimeout: 2s
        retryOn: 5xx,connect-failure,refused-stream
`,

    'envoy/circuit-breaker.yaml': `# Envoy Circuit Breaker Configuration
# Cluster with circuit breaker thresholds

name: product-service
type: STRICT_DNS
connect_timeout: 5s
circuit_breakers:
  thresholds:
    - priority: DEFAULT
      max_connections: 100
      max_pending_requests: 50
      max_requests: 100
      max_retries: 3
      track_remaining: true
    - priority: HIGH
      max_connections: 200
      max_pending_requests: 100
      max_requests: 200
      max_retries: 5
outlier_detection:
  consecutive_5xx: 5
  interval: 30s
  base_ejection_time: 30s
  max_ejection_percent: 50
  success_minimum: 5
  enforcing_percentage: 100
http2_protocol_options: {}
load_assignment:
  cluster_name: product-service
  endpoints:
    - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: product-service.default.svc.cluster.local
                port_value: 8080
`,

    'kubernetes/hpa.yaml': `# Kubernetes Horizontal Pod Autoscaler
# Scales pods based on CPU/memory/custom metrics

apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: product-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: product-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "1000"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30
        - type: Pods
          value: 2
          periodSeconds: 60
      selectPolicy: Max
`,

    'docker-compose.yml': `version: '3.8'

services:
  # Product Service with Circuit Breaker
  product-service:
    image: myorg/product-service:1.0.0
    container_name: product-service
    ports:
      - "3001:3000"
    environment:
      - CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
      - CIRCUIT_BREAKER_TIMEOUT=30000
      - RETRY_MAX_ATTEMPTS=3
      - RETRY_INITIAL_DELAY=1000
      - RATE_LIMIT_MAX_REQUESTS=100
      - RATE_LIMIT_WINDOW_MS=60000
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
      restart_policy:
        condition: on-failure
        max_attempts: 3
    networks:
      - resilience-net
    depends_on:
      - redis

  # Order Service with Circuit Breaker
  order-service:
    image: myorg/order-service:1.0.0
    container_name: order-service
    ports:
      - "3002:3000"
    environment:
      - PRODUCT_SERVICE_URL=http://product-service:3000
      - CIRCUIT_BREAKER_FAILURE_THRESHOLD=3
      - RETRY_MAX_ATTEMPTS=5
      - TIMEOUT_MS=5000
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    networks:
      - resilience-net
    depends_on:
      - product-service

  # Redis for distributed rate limiting
  redis:
    image: redis:7-alpine
    container_name: redis
    ports:
      - "6379:6379"
    networks:
      - resilience-net

  # Prometheus for monitoring
  prometheus:
    image: prom/prometheus:v2.47.0
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    networks:
      - resilience-net

networks:
  resilience-net:
    driver: bridge
`,

    'examples/usage.ts': `// Circuit Breaker Usage Examples

import { CircuitBreaker, CircuitState } from '../circuit-breaker/circuit-breaker';
import { RetryPolicy, RetryStrategies } from '../circuit-breaker/retry-policy';
import { Timeout, TimeoutPresets } from '../circuit-breaker/timeout';
import { RateLimiter } from '../circuit-breaker/rate-limiter';
import { Bulkhead } from '../circuit-breaker/bulkhead';
import { ResiliencePipeline } from '../circuit-breaker/resilience-pipeline';

// Basic Circuit Breaker Usage
const circuitBreaker = new CircuitBreaker('product-service', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  monitoringPeriod: 60000,
  halfOpenMaxCalls: 3,
});

async function fetchProduct(productId: string) {
  return circuitBreaker.execute(
    async () => {
      const response = await fetch(\`http://product-service:3000/api/products/\${productId}\`);
      if (!response.ok) throw new Error('Product not found');
      return response.json();
    },
    () => ({ id: productId, name: 'Fallback Product' })
  );
}

// Retry Policy Usage
const retry = new RetryPolicy(RetryStrategies.exponential);

async function fetchWithRetry(url: string) {
  return retry.execute(async (attempt) => {
    console.log(\`Attempt \${attempt}\`);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Request failed');
    return response.json();
  });
}

// Timeout Usage
const timeout = new Timeout(5000);

async function fetchWithTimeout(url: string) {
  return timeout.execute(async (signal) => {
    const response = await fetch(url, { signal });
    return response.json();
  });
}

// Rate Limiter Usage
const rateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000,
});

async function fetchWithRateLimit(url: string) {
  return rateLimiter.execute(async () => {
    return fetch(url).then(r => r.json());
  });
}

// Bulkhead Usage
const bulkhead = new Bulkhead({
  maxConcurrent: 10,
  maxQueueSize: 20,
});

async function fetchWithBulkhead(url: string) {
  return bulkhead.execute(async () => {
    return fetch(url).then(r => r.json());
  });
}

// Combined Resilience Pipeline
const pipeline = new ResiliencePipeline('order-service', {
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    monitoringPeriod: 60000,
    halfOpenMaxCalls: 3,
  },
  retry: RetryStrategies.exponential,
  timeout: TimeoutPresets.normal,
  bulkhead: {
    maxConcurrent: 10,
    maxQueueSize: 20,
  },
  fallback: () => ({ status: 'degraded' }),
});

async function makeResilientRequest(url: string) {
  return pipeline.execute(
    async () => {
      const response = await fetch(url);
      return response.json();
    },
    () => ({ data: [], cached: true })
  );
}
`,

    'README.md': `# Circuit Breaker Patterns

Complete circuit breaker implementation with retry policies, rate limiting, bulkheads, timeouts, and fallback mechanisms for resilient microservices.

## Features

### Circuit Breaker
- Automatic state transitions (CLOSED, OPEN, HALF_OPEN)
- Configurable failure/success thresholds
- Automatic recovery with half-open state
- Per-circuit statistics

### Retry Policy
- Exponential backoff with jitter
- Linear retry strategy
- Configurable retryable error detection
- Max attempts and delay limits

### Timeout
- Request timeout with AbortController
- Timeout presets for common scenarios
- TimeoutError exception type

### Rate Limiting
- Sliding window rate limiter
- Token bucket rate limiter
- Distributed rate limiting support (Redis)

### Bulkhead
- Concurrent resource limiting
- Queue with max size
- BulkheadError on overload

### Resilience Pipeline
- Combines all resilience patterns
- Fluent configuration
- Per-service pipelines

## Quick Start

bash code for starting the resilience stack

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
	curl http://localhost:3001/api/products
	curl http://localhost:3002/api/orders

clean:
	docker-compose down -v
`
  },

  postInstall: [
    `echo "Setting up circuit breaker patterns..."
echo ""
echo "Resilience Features:"
echo "- Circuit Breaker: Automatic failure detection and recovery"
echo "- Retry Policy: Exponential backoff with jitter"
echo "- Timeout: Request timeout with AbortController"
echo "- Rate Limiting: Sliding window and token bucket"
echo "- Bulkhead: Concurrent resource limiting"
echo ""
echo "Quick Start:"
echo "  make start"
echo ""
echo "Test Circuit Breaker:"
echo "  curl http://localhost:3001/api/products"
`
  ]
};
