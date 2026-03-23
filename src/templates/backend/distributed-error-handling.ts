import { BackendTemplate } from '../types';

/**
 * Distributed Error Handling & Monitoring Template
 * Cross-service error handling with correlation IDs, error aggregation, monitoring, and alerting
 */
export const distributedErrorHandlingTemplate: BackendTemplate = {
  id: 'distributed-error-handling',
  name: 'Distributed Error Handling',
  displayName: 'Distributed Error Handling & Monitoring',
  description: 'Complete distributed error handling system with correlation ID propagation, error aggregation, centralized error tracking, monitoring dashboards, alerting, and integration with OpenTelemetry tracing',
  version: '1.0.0',
  language: 'typescript',
  framework: 'express',
  tags: ['error-handling', 'monitoring', 'distributed-systems', 'correlation-id', 'observability'],
  port: 3000,
  dependencies: {},
  features: ['monitoring'],

  files: {
    'error-handling/correlation-id.ts': `// Correlation ID Management
// Generates and propagates correlation IDs across distributed service calls

import { AsyncLocalStorage } from 'async_hooks';

export interface CorrelationContext {
  correlationId: string;
  parentId?: string;
  traceId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

const correlationContext = new AsyncLocalStorage<CorrelationContext>();

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
  return \`crid-\${Date.now()}-\${Math.random().toString(36).substring(2, 15)}\`;
}

/**
 * Generate a trace ID (compatible with OpenTelemetry/W3C)
 */
export function generateTraceId(): string {
  return \`trace-\${Date.now()}-\${Math.random().toString(16).substring(2, 34)}\`;
}

/**
 * Get the current correlation context
 */
export function getCorrelationContext(): CorrelationContext | undefined {
  return correlationContext.getStore();
}

/**
 * Run a function with correlation context
 */
export function withCorrelationContext<T>(
  context: CorrelationContext,
  callback: () => T
): T {
  return correlationContext.run(context, callback);
}

/**
 * Create a new correlation context with generated IDs
 */
export function createCorrelationContext(
  userId?: string,
  sessionId?: string,
  metadata?: Record<string, any>
): CorrelationContext {
  return {
    correlationId: generateCorrelationId(),
    traceId: generateTraceId(),
    userId,
    sessionId,
    requestId: \`req-\${Date.now()}-\${Math.random().toString(36).substring(2, 15)}\`,
    metadata,
  };
}

/**
 * Extract correlation context from HTTP headers
 */
export function extractCorrelationFromHeaders(headers: Record<string, string>): CorrelationContext {
  const correlationId = headers['x-correlation-id'] || headers['correlation-id'] || generateCorrelationId();
  const traceId = headers['x-trace-id'] || headers['trace-id'] || generateTraceId();
  const parentId = headers['x-parent-id'] || headers['parent-id'];
  const userId = headers['x-user-id'] || headers['user-id'];
  const sessionId = headers['x-session-id'] || headers['session-id'];

  return {
    correlationId,
    traceId,
    parentId,
    userId,
    sessionId,
  };
}

/**
 * Inject correlation context into HTTP headers
 */
export function injectCorrelationIntoHeaders(
  context: CorrelationContext
): Record<string, string> {
  const headers: Record<string, string> = {
    'x-correlation-id': context.correlationId,
    'x-trace-id': context.traceId || '',
  };

  if (context.parentId) {
    headers['x-parent-id'] = context.parentId;
  }
  if (context.userId) {
    headers['x-user-id'] = context.userId;
  }
  if (context.sessionId) {
    headers['x-session-id'] = context.sessionId;
  }
  if (context.requestId) {
    headers['x-request-id'] = context.requestId;
  }

  return headers;
}

/**
 * Express middleware to add correlation context to requests
 */
export function correlationIdMiddleware(req: any, res: any, next: any) {
  const context = extractCorrelationFromHeaders(req.headers);

  // Add to request
  req.correlationContext = context;

  // Run with async local storage
  correlationContext.run(context, () => {
    // Add correlation IDs to response headers
    res.setHeader('x-correlation-id', context.correlationId);
    res.setHeader('x-trace-id', context.traceId);
    if (context.requestId) {
      res.setHeader('x-request-id', context.requestId);
    }

    next();
  });
}
`,

    'error-handling/error-tracker.ts': `// Error Tracking & Aggregation
// Centralized error tracking with categorization, aggregation, and monitoring

import { v4 as uuidv4 } from 'uuid';

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ErrorCategory {
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN',
}

export interface ErrorContext {
  correlationId: string;
  traceId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  service?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface TrackedError {
  id: string;
  message: string;
  stack?: string;
  code?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: ErrorContext;
  aggregated: boolean;
  count: number;
  firstSeen: number;
  lastSeen: number;
  resolved: boolean;
  resolvedAt?: number;
  tags: string[];
}

export interface ErrorStats {
  totalErrors: number;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsByService: Record<string, number>;
  topErrors: TrackedError[];
  recentErrors: TrackedError[];
  criticalErrors: TrackedError[];
}

/**
 * Error Tracker Class
 */
export class ErrorTracker {
  private errors: Map<string, TrackedError> = new Map();
  private errorHistory: TrackedError[] = [];
  private maxHistorySize = 10000;

  /**
   * Track an error
   */
  trackError(
    error: Error,
    context: ErrorContext,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    tags: string[] = []
  ): TrackedError {
    const errorKey = this.getErrorKey(error, category);
    const now = Date.now();

    let trackedError = this.errors.get(errorKey);

    if (trackedError) {
      // Aggregate similar errors
      trackedError.count++;
      trackedError.lastSeen = now;
      trackedError.context = context; // Update with latest context
    } else {
      // Create new tracked error
      trackedError = {
        id: uuidv4(),
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        severity,
        category,
        context,
        aggregated: false,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        resolved: false,
        tags,
      };

      this.errors.set(errorKey, trackedError);
    }

    // Add to history
    this.errorHistory.push({ ...trackedError });
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Alert if critical
    if (severity === ErrorSeverity.CRITICAL) {
      this.sendAlert(trackedError);
    }

    return trackedError;
  }

  /**
   * Get error statistics
   */
  getStats(): ErrorStats {
    const errors = Array.from(this.errors.values());
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const errorsBySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0,
    };

    const errorsByCategory: Record<ErrorCategory, number> = {
      [ErrorCategory.NETWORK]: 0,
      [ErrorCategory.DATABASE]: 0,
      [ErrorCategory.AUTHENTICATION]: 0,
      [ErrorCategory.AUTHORIZATION]: 0,
      [ErrorCategory.VALIDATION]: 0,
      [ErrorCategory.BUSINESS_LOGIC]: 0,
      [ErrorCategory.EXTERNAL_SERVICE]: 0,
      [ErrorCategory.TIMEOUT]: 0,
      [ErrorCategory.RATE_LIMIT]: 0,
      [ErrorCategory.UNKNOWN]: 0,
    };

    const errorsByService: Record<string, number> = {};

    for (const error of errors) {
      errorsBySeverity[error.severity]++;
      errorsByCategory[error.category]++;

      if (error.context.service) {
        errorsByService[error.context.service] =
          (errorsByService[error.context.service] || 0) + error.count;
      }
    }

    return {
      totalErrors: errors.length,
      errorsBySeverity,
      errorsByCategory,
      errorsByService,
      topErrors: errors
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      recentErrors: this.errorHistory
        .filter(e => e.lastSeen > oneHourAgo)
        .sort((a, b) => b.lastSeen - a.lastSeen)
        .slice(0, 20),
      criticalErrors: errors
        .filter(e => e.severity === ErrorSeverity.CRITICAL && !e.resolved),
    };
  }

  /**
   * Get error by ID
   */
  getError(id: string): TrackedError | undefined {
    return Array.from(this.errors.values()).find(e => e.id === id);
  }

  /**
   * Mark error as resolved
   */
  resolveError(id: string): boolean {
    const error = this.getError(id);
    if (error) {
      error.resolved = true;
      error.resolvedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Get error key for aggregation
   */
  private getErrorKey(error: Error, category: ErrorCategory): string {
    return \`\${category}:\${error.message}\`;
  }

  /**
   * Send alert for critical errors
   */
  private sendAlert(error: TrackedError): void {
    // Integration with alerting systems (PagerDuty, Slack, etc.)
    console.error(\`[CRITICAL ERROR] \${error.message}\`, {
      errorId: error.id,
      context: error.context,
      stack: error.stack,
    });
  }

  /**
   * Clear resolved errors older than specified time
   */
  clearResolvedErrors(olderThan: number = 7 * 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const cutoff = now - olderThan;

    for (const [key, error] of this.errors.entries()) {
      if (error.resolved && error.resolvedAt && error.resolvedAt < cutoff) {
        this.errors.delete(key);
      }
    }
  }
}

// Singleton instance
export const errorTracker = new ErrorTracker();
`,

    'error-handling/error-handler.ts': `// Distributed Error Handler
// Global error handling with correlation IDs and automatic tracking

import { Request, Response, NextFunction } from 'express';
import { errorTracker, ErrorSeverity, ErrorCategory } from './error-tracker';
import { getCorrelationContext } from './correlation-id';

export interface ErrorResponse {
  error: {
    id: string;
    message: string;
    code?: string;
    severity: ErrorSeverity;
    category: ErrorCategory;
    correlationId: string;
    traceId?: string;
    requestId?: string;
    timestamp: number;
  };
}

export class DistributedErrorHandler {
  /**
   * Express error handling middleware
   */
  static handle(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const context = getCorrelationContext();

    if (!context) {
      // No correlation context, create one
      return res.status(500).json({
        error: {
          message: err.message,
          timestamp: Date.now(),
        },
      });
    }

    // Categorize error
    const category = categorizeError(err);
    const severity = getErrorSeverity(err);

    // Track error
    const trackedError = errorTracker.trackError(
      err,
      {
        correlationId: context.correlationId,
        traceId: context.traceId,
        userId: context.userId,
        sessionId: context.sessionId,
        requestId: context.requestId,
        service: 'api',
        endpoint: req.path,
        method: req.method,
        userAgent: req.get('user-agent'),
        ip: req.ip,
        timestamp: Date.now(),
      },
      severity,
      category
    );

    // Build error response
    const errorResponse: ErrorResponse = {
      error: {
        id: trackedError.id,
        message: err.message,
        code: (err as any).code,
        severity: trackedError.severity,
        category: trackedError.category,
        correlationId: context.correlationId,
        traceId: context.traceId,
        requestId: context.requestId,
        timestamp: Date.now(),
      },
    };

    // Set appropriate status code
    const statusCode = getStatusCode(err);
    res.status(statusCode).json(errorResponse);
  }

  /**
   * Async wrapper to automatically catch and track errors
   */
  static asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
  ) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Wrap a function with error tracking
   */
  static withErrorTracking<T extends (...args: any[]) => any>(
    fn: T,
    options: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      tags?: string[];
    } = {}
  ): T {
    return (async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        const context = getCorrelationContext();
        if (context) {
          errorTracker.trackError(
            error as Error,
            {
              correlationId: context.correlationId,
              traceId: context.traceId,
              userId: context.userId,
              sessionId: context.sessionId,
              timestamp: Date.now(),
            },
            options.severity,
            options.category,
            options.tags
          );
        }
        throw error;
      }
    }) as T;
  }
}

/**
 * Categorize error based on type and message
 */
function categorizeError(error: Error): ErrorCategory {
  const code = (error as any).code;
  const message = error.message.toLowerCase();

  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
    return ErrorCategory.TIMEOUT;
  }
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    return ErrorCategory.NETWORK;
  }
  if (message.includes('unauthorized') || message.includes('authentication')) {
    return ErrorCategory.AUTHENTICATION;
  }
  if (message.includes('forbidden') || message.includes('permission')) {
    return ErrorCategory.AUTHORIZATION;
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return ErrorCategory.VALIDATION;
  }
  if (message.includes('database') || message.includes('query')) {
    return ErrorCategory.DATABASE;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Get HTTP status code for error
 */
function getStatusCode(error: Error): number {
  const code = (error as any).code;

  if (code === 'UnauthorizedError' || code === 'authentication_failed') {
    return 401;
  }
  if (code === 'ForbiddenError') {
    return 403;
  }
  if (code === 'ValidationError') {
    return 400;
  }
  if (code === 'NotFoundError') {
    return 404;
  }

  return 500;
}

/**
 * Get error severity
 */
function getErrorSeverity(error: Error): ErrorSeverity {
  const code = (error as any).code;

  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
    return ErrorSeverity.HIGH;
  }

  return ErrorSeverity.MEDIUM;
}
`,

    'error-handling/monitoring-dashboard.ts': `// Error Monitoring Dashboard
// Real-time error monitoring with metrics, trends, and alerting

import { errorTracker, ErrorStats } from './error-tracker';
import { EventEmitter } from 'events';

export interface MonitoringMetrics {
  timestamp: number;
  totalErrors: number;
  errorRate: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  activeRequests: number;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (stats: ErrorStats) => boolean;
  action: (stats: ErrorStats) => void;
  enabled: boolean;
  cooldown: number; // milliseconds
  lastTriggered?: number;
}

/**
 * Error Monitoring Dashboard Class
 */
export class ErrorMonitoringDashboard extends EventEmitter {
  private metrics: MonitoringMetrics[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private requestCount = 0;
  private responseTimes: number[] = [];
  private maxResponseTimes = 1000;
  private activeRequests = 0;

  constructor() {
    super();
    this.startMetricsCollection();
  }

  /**
   * Record a request
   */
  recordRequest(responseTime: number): void {
    this.requestCount++;
    this.responseTimes.push(responseTime);

    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes.shift();
    }
  }

  /**
   * Increment active requests
   */
  incrementActiveRequests(): void {
    this.activeRequests++;
  }

  /**
   * Decrement active requests
   */
  decrementActiveRequests(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  /**
   * Get current metrics
   */
  getMetrics(): MonitoringMetrics {
    const stats = errorTracker.getStats();
    const now = Date.now();

    // Calculate response time percentiles
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      timestamp: now,
      totalErrors: stats.totalErrors,
      errorRate: this.requestCount > 0 ? stats.totalErrors / this.requestCount : 0,
      requestsPerSecond: this.calculateRequestsPerSecond(),
      avgResponseTime: this.calculateAverage(),
      p95ResponseTime: sorted[p95Index] || 0,
      p99ResponseTime: sorted[p99Index] || 0,
      activeRequests: this.activeRequests,
    };
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStats {
    return errorTracker.getStats();
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(id: string): boolean {
    return this.alertRules.delete(id);
  }

  /**
   * Check and trigger alert rules
   */
  private checkAlertRules(stats: ErrorStats): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (
        rule.lastTriggered &&
        Date.now() - rule.lastTriggered < rule.cooldown
      ) {
        continue;
      }

      // Check condition
      if (rule.condition(stats)) {
        rule.lastTriggered = Date.now();
        rule.action(stats);
        this.emit('alert', { rule, stats });
      }
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      const metrics = this.getMetrics();
      this.metrics.push(metrics);

      // Keep last hour of metrics
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);

      // Check alert rules
      const stats = this.getErrorStats();
      this.checkAlertRules(stats);

      // Emit metrics event
      this.emit('metrics', metrics);
    }, 60000); // Every minute
  }

  /**
   * Calculate requests per second
   */
  private calculateRequestsPerSecond(): number {
    if (this.metrics.length < 2) return 0;

    const latest = this.metrics[this.metrics.length - 1];
    const previous = this.metrics[this.metrics.length - 2];
    const timeDiff = (latest.timestamp - previous.timestamp) / 1000;

    if (timeDiff <= 0) return 0;

    return this.requestCount / timeDiff;
  }

  /**
   * Calculate average response time
   */
  private calculateAverage(): number {
    if (this.responseTimes.length === 0) return 0;

    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    return sum / this.responseTimes.length;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(duration: number = 60 * 60 * 1000): MonitoringMetrics[] {
    const cutoff = Date.now() - duration;
    return this.metrics.filter(m => m.timestamp > cutoff);
  }
}

// Singleton instance
export const monitoringDashboard = new ErrorMonitoringDashboard();

/**
 * Setup default alert rules
 */
export function setupDefaultAlerts(dashboard: ErrorMonitoringDashboard): void {
  // Critical error alert
  dashboard.addAlertRule({
    id: 'critical-errors',
    name: 'Critical Errors',
    condition: (stats) => stats.criticalErrors.length > 0,
    action: (stats) => {
      console.error(\`[ALERT] \${stats.criticalErrors.length} critical errors detected!\`);
      // Send to PagerDuty, Slack, etc.
    },
    enabled: true,
    cooldown: 5 * 60 * 1000, // 5 minutes
  });

  // High error rate alert
  dashboard.addAlertRule({
    id: 'high-error-rate',
    name: 'High Error Rate',
    condition: (stats) => {
      const total = Object.values(stats.errorsBySeverity).reduce((a, b) => a + b, 0);
      return total > 100;
    },
    action: (stats) => {
      console.warn(\`[ALERT] High error rate: \${stats.totalErrors} errors\`);
    },
    enabled: true,
    cooldown: 10 * 60 * 1000, // 10 minutes
  });

  // Error spike alert
  dashboard.addAlertRule({
    id: 'error-spike',
    name: 'Error Spike',
    condition: (stats) => {
      const recent = stats.recentErrors.length;
      return recent > 50;
    },
    action: (stats) => {
      console.warn(\`[ALERT] Error spike detected: \${stats.recentErrors.length} errors in last hour\`);
    },
    enabled: true,
    cooldown: 15 * 60 * 1000, // 15 minutes
  });
}
`,

    'error-handling/index.ts': `// Distributed Error Handling System
// Main entry point exporting all error handling components

export {
  generateCorrelationId,
  generateTraceId,
  getCorrelationContext,
  withCorrelationContext,
  createCorrelationContext,
  extractCorrelationFromHeaders,
  injectCorrelationIntoHeaders,
  correlationIdMiddleware,
  CorrelationContext,
} from './correlation-id';

export {
  ErrorTracker,
  errorTracker,
  ErrorSeverity,
  ErrorCategory,
  TrackedError,
  ErrorContext,
  ErrorStats,
} from './error-tracker';

export {
  DistributedErrorHandler,
  ErrorResponse,
  withErrorTracking,
  asyncHandler,
} from './error-handler';

export {
  ErrorMonitoringDashboard,
  monitoringDashboard,
  setupDefaultAlerts,
  MonitoringMetrics,
  AlertRule,
} from './monitoring-dashboard';
`,

    'error-handling/README.md': `# Distributed Error Handling & Monitoring

Complete distributed error handling system with correlation ID propagation, error aggregation, centralized error tracking, monitoring dashboards, and alerting.

## Features

- **Correlation ID Propagation**: Automatically generates and propagates correlation IDs across all service calls
- **Error Aggregation**: Aggregates similar errors to reduce noise and identify patterns
- **Centralized Tracking**: Single source of truth for all errors across services
- **Real-time Monitoring**: Live dashboard with metrics, trends, and statistics
- **Smart Alerting**: Configurable alert rules with cooldown periods
- **OpenTelemetry Integration**: Compatible with OpenTelemetry tracing

## Installation

\`\`\`bash
npm install async-hooks
npm install uuid
npm install @opentelemetry/api
\`\`\`

## Quick Start

\`\`\`typescript
import express from 'express';
import {
  correlationIdMiddleware,
  DistributedErrorHandler,
  monitoringDashboard,
  setupDefaultAlerts,
} from './error-handling';

const app = express();

// Add correlation ID middleware
app.use(correlationIdMiddleware);

// Setup monitoring
setupDefaultAlerts(monitoringDashboard);

// Your routes
app.get('/api/users', async (req, res, next) => {
  try {
    // Your code here
    res.json({ users: [] });
  } catch (error) {
    next(error);
  }
});

// Add error handler
app.use(DistributedErrorHandler.handle);

app.listen(3000);
\`\`\`

## Usage

### Tracking Errors Manually

\`\`\`typescript
import { errorTracker, ErrorSeverity, ErrorCategory } from './error-handling';

errorTracker.trackError(
  new Error('Database connection failed'),
  {
    correlationId: 'crid-123',
    traceId: 'trace-456',
    service: 'user-service',
    endpoint: '/api/users',
    timestamp: Date.now(),
  },
  ErrorSeverity.HIGH,
  ErrorCategory.DATABASE,
  ['database', 'connection']
);
\`\`\`

### Wrapping Functions with Error Tracking

\`\`\`typescript
import { withErrorTracking } from './error-handling';

const safeFunction = withErrorTracking(
  async (userId: string) => {
    // Function that might throw
    return await database.getUser(userId);
  },
  {
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.DATABASE,
    tags: ['user-fetch'],
  }
);
\`\`\`

### Monitoring Dashboard

\`\`\`typescript
import { monitoringDashboard } from './error-handling';

// Get current metrics
const metrics = monitoringDashboard.getMetrics();
console.log('Error rate:', metrics.errorRate);
console.log('Active requests:', metrics.activeRequests);

// Get error statistics
const stats = monitoringDashboard.getErrorStats();
console.log('Total errors:', stats.totalErrors);
console.log('Top errors:', stats.topErrors);

// Listen for metrics updates
monitoringDashboard.on('metrics', (metrics) => {
  console.log('New metrics:', metrics);
});

// Listen for alerts
monitoringDashboard.on('alert', ({ rule, stats }) => {
  console.log(\`Alert triggered: \${rule.name}\`);
});
\`\`\`

### Custom Alert Rules

\`\`\`typescript
import { monitoringDashboard } from './error-handling';

monitoringDashboard.addAlertRule({
  id: 'custom-alert',
  name: 'Custom Alert',
  condition: (stats) => {
    return stats.errorsByCategory[ErrorCategory.DATABASE] > 10;
  },
  action: (stats) => {
    // Send alert to Slack, PagerDuty, etc.
    console.warn(\`Database error threshold exceeded!\`);
  },
  enabled: true,
  cooldown: 5 * 60 * 1000,
});
\`\`\`

## API Reference

### Correlation ID Management

- \`generateCorrelationId()\`: Generate a new correlation ID
- \`generateTraceId()\`: Generate a new trace ID
- \`getCorrelationContext()\`: Get current correlation context
- \`withCorrelationContext(context, callback)\`: Run callback with context

### Error Tracker

- \`errorTracker.trackError(error, context, severity, category, tags)\`: Track an error
- \`errorTracker.getStats()\`: Get error statistics
- \`errorTracker.getError(id)\`: Get error by ID
- \`errorTracker.resolveError(id)\`: Mark error as resolved

### Monitoring Dashboard

- \`monitoringDashboard.getMetrics()\`: Get current metrics
- \`monitoringDashboard.getErrorStats()\`: Get error statistics
- \`monitoringDashboard.addAlertRule(rule)\`: Add alert rule
- \`monitoringDashboard.removeAlertRule(id)\`: Remove alert rule

## Integration with OpenTelemetry

The correlation IDs are compatible with OpenTelemetry trace IDs. You can use both systems together:

\`\`\`typescript
import { tracer } from '@opentelemetry/api';
import { getCorrelationContext } from './error-handling';

const span = tracer.startActiveSpan('operation', (span) => {
  const context = getCorrelationContext();
  span.setAttributes({
    'correlation.id': context?.correlationId,
    'trace.id': context?.traceId,
  });
  // Your code here
});
\`\`\`

## License

MIT
`,

    'docker-compose.yml': `version: '3.8'

services:
  error-handling-demo:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=error_handling
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  postgres-data:
  prometheus-data:
  grafana-data:
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "dev"]
`,

    'package.json': `{
  "name": "distributed-error-handling",
  "version": "1.0.0",
  "description": "Distributed error handling and monitoring system",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  },
  "keywords": [
    "error-handling",
    "monitoring",
    "distributed-systems",
    "correlation-id"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "uuid": "^9.0.0",
    "@opentelemetry/api": "^1.7.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.0.0",
    "@types/uuid": "^9.0.0",
    "typescript": "^5.0.0",
    "ts-node-dev": "^2.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  }
}
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
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`,

    'src/index.ts': `import express from 'express';
import {
  correlationIdMiddleware,
  DistributedErrorHandler,
  monitoringDashboard,
  setupDefaultAlerts,
} from '../error-handling';

const app = express();

// Middleware
app.use(express.json());
app.use(correlationIdMiddleware);

// Setup monitoring
setupDefaultAlerts(monitoringDashboard);

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Distributed Error Handling Demo',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/stats', (req, res) => {
  const stats = monitoringDashboard.getErrorStats();
  res.json(stats);
});

app.get('/api/metrics', (req, res) => {
  const metrics = monitoringDashboard.getMetrics();
  res.json(metrics);
});

// Error demo endpoints
app.get('/api/error', (req, res, next) => {
  next(new Error('This is a demo error'));
});

app.get('/api/critical-error', (req, res, next) => {
  const error = new Error('Critical database failure') as any;
  error.code = 'DATABASE_ERROR';
  next(error);
});

// Error handler
app.use(DistributedErrorHandler.handle);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
  console.log(\`http://localhost:\${PORT}\`);
  console.log(\`Stats: http://localhost:\${PORT}/api/stats\`);
  console.log(\`Metrics: http://localhost:\${PORT}/api/metrics\`);
});
`,
  },
};
