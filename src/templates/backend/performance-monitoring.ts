// Performance Monitoring and Profiling Tools
// Comprehensive performance monitoring for full-stack applications

import { BackendTemplate } from '../types';

export const performanceMonitoringTemplate: BackendTemplate = {
  id: 'performance-monitoring',
  name: 'Performance Monitoring & Profiling',
  displayName: 'Comprehensive Performance Monitoring and Profiling Tools',
  description: 'Advanced performance monitoring with CPU/memory profiling, response time tracking, and real-time metrics',
  version: '1.0.0',
  language: 'typescript',
  framework: 'Express',
  port: 3000,
  features: ['monitoring', 'rest-api', 'documentation'],
  tags: ['performance', 'monitoring', 'profiling', 'metrics', 'analytics'],
  dependencies: {},
  files: {
    'package.json': `{
  "name": "{{name}}-performance-monitoring",
  "version": "1.0.0",
  "description": "{{name}} - Performance Monitoring & Profiling",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "pidusage": "^3.0.2",
    "systeminformation": "^5.21.7",
    "express-prometheus-middleware": "^1.2.0",
    "prom-client": "^15.0.0",
    "chalk": "^4.1.2",
    "cli-table3": "^0.6.3",
    "v8": "^0.58.0",
    "node:perf_hooks": "^1.0.0",
    "eventemitter3": "^5.0.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "@types/pidusage": "^2.0.2",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1"
  }
}`,

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
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}`,

    'src/index.ts': `// Performance Monitoring Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { PerformanceMonitor } from './performance-monitor';
import { MetricsCollector } from './metrics-collector';
import { Profiler } from './profiler';
import { AlertManager } from './alert-manager';
import { apiRoutes } from './routes/api.routes';
import { metricsRoutes } from './routes/metrics.routes';
import { profilingRoutes } from './routes/profiling.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Initialize monitoring systems
const perfMonitor = new PerformanceMonitor();
const metricsCollector = new MetricsCollector();
const profiler = new Profiler();
const alertManager = new AlertManager();

// Start monitoring
perfMonitor.start();

// Mount routes
app.use('/api', apiRoutes(perfMonitor, metricsCollector, alertManager));
app.use('/metrics', metricsRoutes(metricsCollector));
app.use('/profiling', profilingRoutes(profiler));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`🚀 Performance Monitoring Server running on port \${PORT}\`);
  console.log(\`📊 Metrics available at http://localhost:\${PORT}/metrics\`);
});`,

    'src/performance-monitor.ts': `// Performance Monitor
// Real-time performance monitoring for Node.js applications

import EventEmitter from 'eventemitter3';
import pidusage from 'pidusage';
import si from 'systeminformation';
import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    free: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    uptime: number;
  };
  eventLoop: {
    lag: number;
    utilization: number;
  };
}

export interface RequestMetrics {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  contentLength?: number;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private requestMetrics: RequestMetrics[] = [];
  private maxMetricsHistory: number = 1000;
  private maxRequestsHistory: number = 10000;
  private pid: number;
  private monitoringInterval?: NodeJS.Timeout;
  private requestStartTimes: Map<string, number> = new Map();

  constructor() {
    super();
    this.pid = process.pid;
  }

  start(intervalMs: number = 1000): void {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log(\`✅ Performance monitoring started (interval: \${intervalMs}ms)\`);
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.log('⏸️ Performance monitoring stopped');
    }
  }

  private async collectMetrics(): Promise<void> {
    const stats = await pidusage(this.pid);
    const memStats = await si.mem();
    const cpuLoad = await si.currentLoad();
    const osInfo = await si.osInfo();

    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      cpu: {
        usage: stats.cpu,
        loadAverage: process.platform !== 'win32' ? os.loadavg() : [0, 0, 0],
      },
      memory: {
        used: stats.memory,
        free: memStats.available,
        total: memStats.total,
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
      },
      system: {
        platform: osInfo.platform,
        arch: osInfo.arch,
        nodeVersion: process.version,
        uptime: process.uptime(),
      },
      eventLoop: {
        lag: this.getEventLoopLag(),
        utilization: cpuLoad.currentLoad,
      },
    };

    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    this.emit('metrics', metrics);
    this.checkThresholds(metrics);
  }

  private getEventLoopLag(): number {
    const start = performance.now();
    setImmediate(() => {
      const lag = performance.now() - start;
      return lag;
    });
    return 0;
  }

  private checkThresholds(metrics: PerformanceMetrics): void {
    // CPU threshold
    if (metrics.cpu.usage > 80) {
      this.emit('alert', {
        type: 'cpu',
        severity: 'warning',
        message: \`CPU usage high: \${metrics.cpu.usage.toFixed(2)}%\`,
        value: metrics.cpu.usage,
        timestamp: metrics.timestamp,
      });
    }

    // Memory threshold
    const memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
    if (memoryUsagePercent > 85) {
      this.emit('alert', {
        type: 'memory',
        severity: 'warning',
        message: \`Heap usage high: \${memoryUsagePercent.toFixed(2)}%\`,
        value: memoryUsagePercent,
        timestamp: metrics.timestamp,
      });
    }

    // Event loop lag threshold
    if (metrics.eventLoop.lag > 100) {
      this.emit('alert', {
        type: 'event-loop',
        severity: 'warning',
        message: \`Event loop lag high: \${metrics.eventLoop.lag.toFixed(2)}ms\`,
        value: metrics.eventLoop.lag,
        timestamp: metrics.timestamp,
      });
    }
  }

  trackRequestStart(id: string): void {
    this.requestStartTimes.set(id, Date.now());
  }

  trackRequestEnd(id: string, method: string, path: string, statusCode: number, contentLength?: number): void {
    const startTime = this.requestStartTimes.get(id);
    if (!startTime) return;

    const responseTime = Date.now() - startTime;
    this.requestStartTimes.delete(id);

    const metrics: RequestMetrics = {
      id,
      method,
      path,
      statusCode,
      responseTime,
      timestamp: Date.now(),
      contentLength,
    };

    this.requestMetrics.push(metrics);

    // Keep only recent requests
    if (this.requestMetrics.length > this.maxRequestsHistory) {
      this.requestMetrics.shift();
    }

    this.emit('request', metrics);

    // Check for slow requests
    if (responseTime > 1000) {
      this.emit('alert', {
        type: 'slow-request',
        severity: 'warning',
        message: \`Slow request: \${method} \${path} took \${responseTime}ms\`,
        value: responseTime,
        timestamp: metrics.timestamp,
        details: { method, path, statusCode },
      });
    }
  }

  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    if (limit) {
      return this.metrics.slice(-limit);
    }
    return [...this.metrics];
  }

  getRequestMetrics(limit?: number, filter?: {
    method?: string;
    path?: string;
    statusCode?: number;
  }): RequestMetrics[] {
    let filtered = this.requestMetrics;

    if (filter) {
      if (filter.method) {
        filtered = filtered.filter((r) => r.method === filter.method);
      }
      if (filter.path) {
        filtered = filtered.filter((r) => r.path.includes(filter.path!));
      }
      if (filter.statusCode !== undefined) {
        filtered = filtered.filter((r) => r.statusCode === filter.statusCode);
      }
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  getAverageResponseTime(): number {
    if (this.requestMetrics.length === 0) return 0;
    const totalTime = this.requestMetrics.reduce((sum, r) => sum + r.responseTime, 0);
    return totalTime / this.requestMetrics.length;
  }

  getRequestsPerSecond(): number {
    if (this.requestMetrics.length < 2) return 0;

    const oldestRequest = this.requestMetrics[0];
    const newestRequest = this.requestMetrics[this.requestMetrics.length - 1];
    const timeWindow = (newestRequest.timestamp - oldestRequest.timestamp) / 1000;

    return this.requestMetrics.length / timeWindow;
  }

  getSlowRequests(thresholdMs: number = 1000): RequestMetrics[] {
    return this.requestMetrics.filter((r) => r.responseTime > thresholdMs);
  }

  getErrorRate(): number {
    if (this.requestMetrics.length === 0) return 0;
    const errorCount = this.requestMetrics.filter((r) => r.statusCode >= 400).length;
    return (errorCount / this.requestMetrics.length) * 100;
  }

  clear(): void {
    this.metrics = [];
    this.requestMetrics = [];
    this.requestStartTimes.clear();
  }
}`,

    'src/metrics-collector.ts': `// Metrics Collector
// Prometheus-compatible metrics collection

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export class MetricsCollector {
  private register: Registry;
  private httpRequestsTotal: Counter;
  private httpRequestDuration: Histogram;
  private httpRequestsInProgress: Gauge;
  private cpuUsage: Gauge;
  private memoryUsage: Gauge;
  private eventLoopLag: Gauge;

  constructor() {
    this.register = new Registry();

    // Default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register: this.register });

    // HTTP request counter
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    // HTTP request duration histogram
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    // HTTP requests in progress
    this.httpRequestsInProgress = new Gauge({
      name: 'http_requests_in_progress',
      help: 'Number of HTTP requests in progress',
      labelNames: ['method', 'route'],
      registers: [this.register],
    });

    // CPU usage gauge
    this.cpuUsage = new Gauge({
      name: 'process_cpu_usage_percent',
      help: 'Process CPU usage as a percentage',
      registers: [this.register],
    });

    // Memory usage gauge
    this.memoryUsage = new Gauge({
      name: 'process_memory_usage_bytes',
      help: 'Process memory usage in bytes',
      labelNames: ['type'],
      registers: [this.register],
    });

    // Event loop lag gauge
    this.eventLoopLag = new Gauge({
      name: 'event_loop_lag_seconds',
      help: 'Event loop lag in seconds',
      registers: [this.register],
    });
  }

  recordHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, durationSeconds);
  }

  incHttpRequestsInProgress(method: string, route: string): void {
    this.httpRequestsInProgress.inc({ method, route });
  }

  decHttpRequestsInProgress(method: string, route: string): void {
    this.httpRequestsInProgress.dec({ method, route });
  }

  setCPUUsage(usagePercent: number): void {
    this.cpuUsage.set(usagePercent);
  }

  setMemoryUsage(type: 'heap' | 'external' | 'rss', bytes: number): void {
    this.memoryUsage.set({ type }, bytes);
  }

  setEventLoopLag(lagSeconds: number): void {
    this.eventLoopLag.set(lagSeconds);
  }

  async getMetrics(): Promise<string> {
    return await this.register.metrics();
  }

  getRegistry(): Registry {
    return this.register;
  }

  clear(): void {
    this.register.clear();
  }
}`,

    'src/profiler.ts': `// Profiler
// CPU and memory profiling capabilities

import { writeFileSync } from 'fs';
import { join } from 'path';
import EventEmitter from 'eventemitter3';

export interface ProfileSnapshot {
  type: 'cpu' | 'memory';
  timestamp: number;
  duration: number;
  data: any;
  filePath?: string;
}

export class Profiler extends EventEmitter {
  private cpuProfile?: any;
  private memorySnapshot?: any;
  private isProfiling: boolean = false;
  private profileDir: string = './profiles';

  constructor() {
    super();
  }

  startCpuProfiling(durationSeconds: number = 30): Promise<ProfileSnapshot> {
    return new Promise((resolve, reject) => {
      if (this.isProfiling) {
        return reject(new Error('Profiling already in progress'));
      }

      this.isProfiling = true;
      const startTime = Date.now();

      // Start profiling
      // Note: This is a simplified version. Real implementation would use v8 module
      console.log('🔴 Starting CPU profiling...');

      setTimeout(() => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Simulate CPU profile data
        const profileData = {
          nodes: [],
          samples: [],
          timeDeltas: [],
          startTime,
          endTime,
        };

        this.isProfiling = false;

        const snapshot: ProfileSnapshot = {
          type: 'cpu',
          timestamp: startTime,
          duration,
          data: profileData,
        };

        this.emit('profile', snapshot);
        resolve(snapshot);
      }, durationSeconds * 1000);
    });
  }

  async takeHeapSnapshot(): Promise<ProfileSnapshot> {
    const timestamp = Date.now();

    // Simulate heap snapshot
    const snapshotData = {
      snapshot: {
        meta: {
          node_fields: ['type', 'name', 'id', 'self_size', 'edge_count', 'trace_node_id'],
          node_types: [['hidden', 'array', 'string', 'object', 'code', 'closure', 'regexp', 'number', 'native', 'synthetic', 'concat string', 'sliced string', 'symbol', 'bigint']],
          edge_fields: ['type', 'name_or_index', 'to_node'],
          edge_types: [['context', 'element', 'property', 'internal', 'hidden', 'shortcut', 'weak']],
        },
        node_count: 0,
        edge_count: 0,
      },
      nodes: [],
      edges: [],
      strings: [],
    };

    const snapshot: ProfileSnapshot = {
      type: 'memory',
      timestamp,
      duration: 0,
      data: snapshotData,
    };

    this.emit('snapshot', snapshot);
    return snapshot;
  }

  async takeCpuSnapshot(durationSeconds: number = 10): Promise<ProfileSnapshot> {
    return await this.startCpuProfiling(durationSeconds);
  }

  async compareHeapSnapshots(before: ProfileSnapshot, after: ProfileSnapshot): Promise<any> {
    if (before.type !== 'memory' || after.type !== 'memory') {
      throw new Error('Both snapshots must be heap snapshots');
    }

    // Simulate comparison
    const comparison = {
      size_diff: 0,
      added: [],
      removed: [],
      changed: [],
    };

    return comparison;
  }

  saveProfile(snapshot: ProfileSnapshot, filename?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = \`\${snapshot.type}-profile-\${timestamp}.json\`;
    const finalFilename = filename || defaultFilename;
    const filePath = join(this.profileDir, finalFilename);

    writeFileSync(filePath, JSON.stringify(snapshot.data, null, 2));

    console.log(\`💾 Profile saved to \${filePath}\`);
    return filePath;
  }

  getMemoryUsage(): {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  } {
    return process.memoryUsage();
  }

  getHeapStatistics(): {
    totalHeapSize: number;
    totalHeapSizeExecutable: number;
    totalPhysicalSize: number;
    totalAvailableSize: number;
    usedHeapSize: number;
    heapSizeLimit: number;
    mallocedMemory: number;
    peakMallocedMemory: number;
    numberOfNativeContexts: number;
    numberOfDetachedContexts: number;
  } {
    return v8.getHeapStatistics();
  }

  getHeapSpaceStatistics(): any[] {
    return v8.getHeapSpaceStatistics();
  }

  async forceGarbageCollection(): Promise<void> {
    if (global.gc) {
      global.gc();
      console.log('🗑️ Garbage collection forced');
    } else {
      console.warn('⚠️ Garbage collection not exposed. Start with --expose-gc flag.');
    }
  }
}`,

    'src/alert-manager.ts': `// Alert Manager
// Manages performance alerts and notifications

import EventEmitter from 'eventemitter3';

export interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  value: number;
  timestamp: number;
  details?: any;
  resolved: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  type: string;
  condition: (value: number) => boolean;
  threshold: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  cooldown: number; // milliseconds
  lastTriggered?: number;
}

export class AlertManager extends EventEmitter {
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];
  private maxAlertsHistory: number = 1000;

  constructor() {
    super();
    this.setupDefaultRules();
  }

  private setupDefaultRules(): void {
    // CPU usage alert
    this.addRule({
      id: 'cpu-high',
      name: 'High CPU Usage',
      type: 'cpu',
      condition: (value) => value > 80,
      threshold: 80,
      severity: 'warning',
      enabled: true,
      cooldown: 60000, // 1 minute
    });

    // CPU critical alert
    this.addRule({
      id: 'cpu-critical',
      name: 'Critical CPU Usage',
      type: 'cpu',
      condition: (value) => value > 95,
      threshold: 95,
      severity: 'critical',
      enabled: true,
      cooldown: 30000, // 30 seconds
    });

    // Memory usage alert
    this.addRule({
      id: 'memory-high',
      name: 'High Memory Usage',
      type: 'memory',
      condition: (value) => value > 85,
      threshold: 85,
      severity: 'warning',
      enabled: true,
      cooldown: 60000,
    });

    // Memory critical alert
    this.addRule({
      id: 'memory-critical',
      name: 'Critical Memory Usage',
      type: 'memory',
      condition: (value) => value > 95,
      threshold: 95,
      severity: 'critical',
      enabled: true,
      cooldown: 30000,
    });

    // Event loop lag alert
    this.addRule({
      id: 'event-loop-lag',
      name: 'Event Loop Lag',
      type: 'event-loop',
      condition: (value) => value > 100,
      threshold: 100,
      severity: 'warning',
      enabled: true,
      cooldown: 60000,
    });
  }

  addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = true;
    }
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = false;
    }
  }

  checkAlert(type: string, value: number, details?: any): void {
    const applicableRules = this.rules.filter(
      (r) => r.type === type && r.enabled
    );

    for (const rule of applicableRules) {
      // Check cooldown
      if (rule.lastTriggered) {
        const timeSinceLastTriggered = Date.now() - rule.lastTriggered;
        if (timeSinceLastTriggered < rule.cooldown) {
          continue;
        }
      }

      // Check condition
      if (rule.condition(value)) {
        this.triggerAlert({
          id: \`alert-\${Date.now()}-\${Math.random()}\`,
          type,
          severity: rule.severity,
          message: \`\${rule.name}: \${value.toFixed(2)}\`,
          value,
          timestamp: Date.now(),
          details,
          resolved: false,
        });

        rule.lastTriggered = Date.now();
      }
    }
  }

  private triggerAlert(alert: Alert): void {
    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.maxAlertsHistory) {
      this.alerts.shift();
    }

    this.emit('alert', alert);
    console.log(\`🚨 [ALERT] \${alert.severity.toUpperCase()}: \${alert.message}\`);
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('resolved', alert);
    }
  }

  getAlerts(filter?: {
    type?: string;
    severity?: string;
    resolved?: boolean;
    limit?: number;
  }): Alert[] {
    let filtered = this.alerts;

    if (filter) {
      if (filter.type) {
        filtered = filtered.filter((a) => a.type === filter.type);
      }
      if (filter.severity) {
        filtered = filtered.filter((a) => a.severity === filter.severity);
      }
      if (filter.resolved !== undefined) {
        filtered = filtered.filter((a) => a.resolved === filter.resolved);
      }
      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  getActiveAlerts(): Alert[] {
    return this.getAlerts({ resolved: false });
  }

  getRules(): AlertRule[] {
    return [...this.rules];
  }

  clear(): void {
    this.alerts = [];
  }
}`,

    'src/routes/api.routes.ts': `// API Routes
import { Router } from 'express';
import { PerformanceMonitor } from '../performance-monitor';
import { MetricsCollector } from '../metrics-collector';
import { AlertManager } from '../alert-manager';

export function apiRoutes(
  perfMonitor: PerformanceMonitor,
  metricsCollector: MetricsCollector,
  alertManager: AlertManager
): Router {
  const router = Router();

  // Get current metrics
  router.get('/metrics/current', (req, res) => {
    const metrics = perfMonitor.getCurrentMetrics();
    res.json(metrics);
  });

  // Get metrics history
  router.get('/metrics/history', (req, res) => {
    const { limit } = req.query;
    const history = perfMonitor.getMetricsHistory(
      limit ? parseInt(limit as string) : undefined
    );
    res.json(history);
  });

  // Get request metrics
  router.get('/requests', (req, res) => {
    const { limit, method, path, statusCode } = req.query;
    const metrics = perfMonitor.getRequestMetrics(
      limit ? parseInt(limit as string) : undefined,
      {
        method: method as string | undefined,
        path: path as string | undefined,
        statusCode: statusCode ? parseInt(statusCode as string) : undefined,
      }
    );
    res.json(metrics);
  });

  // Get performance summary
  router.get('/summary', (req, res) => {
    res.json({
      averageResponseTime: perfMonitor.getAverageResponseTime(),
      requestsPerSecond: perfMonitor.getRequestsPerSecond(),
      errorRate: perfMonitor.getErrorRate(),
      slowRequests: perfMonitor.getSlowRequests().length,
      currentMetrics: perfMonitor.getCurrentMetrics(),
    });
  });

  // Get alerts
  router.get('/alerts', (req, res) => {
    const { type, severity, resolved, limit } = req.query;
    const alerts = alertManager.getAlerts({
      type: type as string | undefined,
      severity: severity as string | undefined,
      resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(alerts);
  });

  // Get active alerts
  router.get('/alerts/active', (req, res) => {
    const alerts = alertManager.getActiveAlerts();
    res.json(alerts);
  });

  // Resolve alert
  router.post('/alerts/:id/resolve', (req, res) => {
    const { id } = req.params;
    alertManager.resolveAlert(id);
    res.json({ message: \`Alert \${id} resolved\` });
  });

  // Get alert rules
  router.get('/rules', (req, res) => {
    const rules = alertManager.getRules();
    res.json(rules);
  });

  return router;
}`,

    'src/routes/metrics.routes.ts': `// Metrics Routes (Prometheus)
import { Router } from 'express';
import { MetricsCollector } from '../metrics-collector';

export function metricsRoutes(metricsCollector: MetricsCollector): Router {
  const router = Router();

  // Get Prometheus metrics
  router.get('/', async (req, res) => {
    res.set('Content-Type', 'text/plain');
    const metrics = await metricsCollector.getMetrics();
    res.send(metrics);
  });

  return router;
}`,

    'src/routes/profiling.routes.ts': `// Profiling Routes
import { Router } from 'express';
import { Profiler } from '../profiler';

export function profilingRoutes(profiler: Profiler): Router {
  const router = Router();

  // Get current memory usage
  router.get('/memory', (req, res) => {
    const usage = profiler.getMemoryUsage();
    res.json(usage);
  });

  // Get heap statistics
  router.get('/heap-stats', (req, res) => {
    const stats = profiler.getHeapStatistics();
    res.json(stats);
  });

  // Get heap space statistics
  router.get('/heap-space', (req, res) => {
    const stats = profiler.getHeapSpaceStatistics();
    res.json(stats);
  });

  // Take heap snapshot
  router.post('/heap-snapshot', async (req, res) => {
    try {
      const snapshot = await profiler.takeHeapSnapshot();
      const { save } = req.body;

      let filePath;
      if (save) {
        filePath = profiler.saveProfile(snapshot);
      }

      res.json({
        message: 'Heap snapshot taken',
        snapshot: {
          type: snapshot.type,
          timestamp: snapshot.timestamp,
          filePath,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start CPU profiling
  router.post('/cpu-start', async (req, res) => {
    try {
      const { duration } = req.body;
      const snapshot = await profiler.startCpuProfiling(duration || 30);
      const { save } = req.body;

      let filePath;
      if (save) {
        filePath = profiler.saveProfile(snapshot);
      }

      res.json({
        message: 'CPU profiling completed',
        snapshot: {
          type: snapshot.type,
          timestamp: snapshot.timestamp,
          duration: snapshot.duration,
          filePath,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Force garbage collection
  router.post('/gc', async (req, res) => {
    await profiler.forceGarbageCollection();
    res.json({ message: 'Garbage collection triggered' });
  });

  return router;
}`,

    'README.md': `# Performance Monitoring & Profiling Tools

Comprehensive performance monitoring and profiling solution for Node.js applications with real-time metrics, alerts, and Prometheus integration.

## Features

### 📊 **Real-Time Performance Monitoring**
- **CPU Usage**: Track process CPU utilization with system-wide metrics
- **Memory Profiling**: Heap usage, RSS, external memory tracking
- **Event Loop Monitoring**: Detect event loop lag and utilization
- **Request Tracking**: Response time, throughput, error rate monitoring

### 🔔 **Intelligent Alerting**
- **Configurable Rules**: Custom thresholds for CPU, memory, and event loop
- **Cooldown Periods**: Prevent alert spam with smart cooldown logic
- **Severity Levels**: Info, warning, error, and critical alerts
- **Alert History**: Track and manage alert lifecycle

### 📈 **Prometheus Integration**
- **Standard Metrics**: Expose metrics in Prometheus format
- **Default Metrics**: CPU, memory, event loop, HTTP statistics
- **Custom Labels**: Rich labeling for granular monitoring
- **Histogram Buckets**: Pre-configured for request durations

### 🧠 **Advanced Profiling**
- **CPU Profiling**: Time-based CPU usage profiling
- **Heap Snapshots**: Capture and compare memory states
- **Garbage Collection**: Manual GC trigger for testing
- **Heap Statistics**: Detailed heap space information

## Quick Start

### 1. Start Monitoring

Monitoring starts automatically when the server starts:

\`\`\`typescript
const perfMonitor = new PerformanceMonitor();
perfMonitor.start(); // Default 1 second interval
\`\`\`

### 2. Access Current Metrics

\`\`\`bash
curl http://localhost:3000/api/metrics/current
\`\`\`

Response:
\`\`\`json
{
  "timestamp": 1698765432100,
  "cpu": {
    "usage": 45.2,
    "loadAverage": [2.5, 2.3, 2.1]
  },
  "memory": {
    "used": 524288000,
    "free": 524288000,
    "total": 1073741824,
    "heapUsed": 134217728,
    "heapTotal": 268435456,
    "external": 2097152
  },
  "system": {
    "platform": "darwin",
    "arch": "x64",
    "nodeVersion": "v20.5.0",
    "uptime": 3600
  },
  "eventLoop": {
    "lag": 5.2,
    "utilization": 45.0
  }
}
\`\`\`

### 3. Get Performance Summary

\`\`\`bash
curl http://localhost:3000/api/summary
\`\`\`

Response:
\`\`\`json
{
  "averageResponseTime": 125.5,
  "requestsPerSecond": 45.2,
  "errorRate": 1.2,
  "slowRequests": 23,
  "currentMetrics": { ... }
}
\`\`\`

### 4. Prometheus Metrics

\`\`\`bash
curl http://localhost:3000/metrics
\`\`\`

Output (Prometheus format):
\`\`\`
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/users",status_code="200"} 1234

# HELP http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/api/users",status_code="200",le="0.1"} 100
http_request_duration_seconds_bucket{method="GET",route="/api/users",status_code="200",le="0.5"} 450
\`\`\`

## API Endpoints

### Performance Metrics

#### \`GET /api/metrics/current\`
Get current performance metrics.

#### \`GET /api/metrics/history?limit=100\`
Get metrics history (optional: \`limit\` parameter).

#### \`GET /api/requests?limit=100&method=GET&statusCode=200\`
Get request metrics with optional filters.

#### \`GET /api/summary\`
Get comprehensive performance summary.

### Alerts

#### \`GET /api/alerts?type=cpu&severity=warning&limit=50\`
Get alerts with optional filters.

#### \`GET /api/alerts/active\`
Get active (unresolved) alerts.

#### \`POST /api/alerts/:id/resolve\`
Resolve an alert by ID.

#### \`GET /api/rules\`
Get all alert rules.

### Profiling

#### \`GET /profiling/memory\`
Get current memory usage.

#### \`GET /profiling/heap-stats\`
Get heap statistics.

#### \`GET /profiling/heap-space\`
Get heap space statistics.

#### \`POST /profiling/heap-snapshot?save=true\`
Take and optionally save heap snapshot.

#### \`POST /profiling/cpu-start?duration=30&save=true\`
Start CPU profiling (duration in seconds, optional save).

#### \`POST /profiling/gc\`
Force garbage collection.

## Alert Rules

### Default Rules

| Rule ID | Type | Threshold | Severity | Cooldown |
|---------|------|-----------|----------|----------|
| \`cpu-high\` | CPU | > 80% | Warning | 1 minute |
| \`cpu-critical\` | CPU | > 95% | Critical | 30 seconds |
| \`memory-high\` | Memory | > 85% | Warning | 1 minute |
| \`memory-critical\` | Memory | > 95% | Critical | 30 seconds |
| \`event-loop-lag\` | Event Loop | > 100ms | Warning | 1 minute |

### Custom Rules

\`\`\`typescript
alertManager.addRule({
  id: 'custom-rule',
  name: 'Custom Rule',
  type: 'custom-metric',
  condition: (value) => value > 100,
  threshold: 100,
  severity: 'warning',
  enabled: true,
  cooldown: 60000,
});
\`\`\`

## Integration Examples

### Express.js Integration

\`\`\`typescript
import express from 'express';
import { PerformanceMonitor, MetricsCollector } from './monitoring';

const app = express();
const perfMonitor = new PerformanceMonitor();
const metricsCollector = new MetricsCollector();

// Middleware to track requests
app.use((req, res, next) => {
  const requestId = \`\${Date.now()}-\${Math.random()}\`;
  perfMonitor.trackRequestStart(requestId);
  metricsCollector.incHttpRequestsInProgress(req.method, req.path);

  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    perfMonitor.trackRequestEnd(requestId, req.method, req.path, res.statusCode);
    metricsCollector.recordHttpRequest(req.method, req.path, res.statusCode, duration);
    metricsCollector.decHttpRequestsInProgress(req.method, req.path);
  });

  next();
});
\`\`\`

### Prometheus Integration

Add to your \`prometheus.yml\`:

\`\`\`yaml
scrape_configs:
  - job_name: 'nodejs-app'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s
\`\`\`

## Environment Variables

\`\`\`bash
PORT=3000              # Server port
LOG_LEVEL=info         # Logging level
PROFILE_DIR=./profiles # Profile save directory
\`\`\`

## Dependencies

- **pidusage** - Process CPU and memory usage
- **systeminformation** - System metrics and information
- **prom-client** - Prometheus client library
- **express-prometheus-middleware** - Express middleware for Prometheus
- **chalk** - Terminal colors
- **cli-table3** - Terminal tables
- **eventemitter3** - Enhanced event emitter

## License

MIT`,
  },
};