import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export interface PerformanceMetric {
  id: string;
  timestamp: Date;
  category: string;
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
}

export interface PerformanceAlert {
  id: string;
  timestamp: Date;
  level: 'warning' | 'critical';
  metric: PerformanceMetric;
  threshold: PerformanceThreshold;
  message: string;
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
    model: string;
    cores: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usage: number;
    heap: NodeJS.MemoryUsage;
  };
  process: {
    pid: number;
    uptime: number;
    cpu: number;
    memory: NodeJS.MemoryUsage;
  };
  disk: {
    available: number;
    used: number;
    total: number;
    usage: number;
  };
  network?: {
    connections: number;
    bytesReceived: number;
    bytesSent: number;
  };
}

export interface PerformanceDashboard {
  overview: {
    totalMetrics: number;
    activeAlerts: number;
    systemHealth: 'good' | 'warning' | 'critical';
    uptime: number;
  };
  realtime: {
    cpu: number;
    memory: number;
    operations: number;
    errors: number;
  };
  trends: {
    period: '1h' | '24h' | '7d' | '30d';
    metrics: Array<{
      name: string;
      current: number;
      average: number;
      trend: 'up' | 'down' | 'stable';
      change: number;
    }>;
  };
  alerts: PerformanceAlert[];
  top: {
    slowestOperations: Array<{ name: string; duration: number; count: number }>;
    memoryConsumers: Array<{ name: string; usage: number }>;
    errorRate: Array<{ name: string; rate: number; count: number }>;
  };
}

export interface PerformanceOptions {
  enabled: boolean;
  collectInterval: number;
  retentionPeriod: number;
  storageDir: string;
  dashboard: {
    enabled: boolean;
    port: number;
    updateInterval: number;
  };
  thresholds: PerformanceThreshold[];
  alerting: {
    enabled: boolean;
    cooldown: number;
  };
  metrics: {
    system: boolean;
    operations: boolean;
    memory: boolean;
    network: boolean;
  };
}

export class PerformanceMonitor extends EventEmitter {
  private options: PerformanceOptions;
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private lastAlerts: Map<string, Date> = new Map();
  private collectTimer?: NodeJS.Timeout;
  private dashboardTimer?: NodeJS.Timeout;
  private operationCounters: Map<string, { count: number; total: number; errors: number }> = new Map();
  private startTime: Date = new Date();

  constructor(options: Partial<PerformanceOptions> = {}) {
    super();
    
    this.options = {
      enabled: true,
      collectInterval: 5000, // 5 seconds
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      storageDir: path.join(process.cwd(), '.re-shell', 'performance'),
      dashboard: {
        enabled: false,
        port: 3030,
        updateInterval: 1000
      },
      thresholds: [
        { metric: 'cpu.usage', warning: 70, critical: 90, unit: '%' },
        { metric: 'memory.usage', warning: 80, critical: 95, unit: '%' },
        { metric: 'operation.duration', warning: 1000, critical: 5000, unit: 'ms' },
        { metric: 'error.rate', warning: 5, critical: 10, unit: '%' }
      ],
      alerting: {
        enabled: true,
        cooldown: 60000 // 1 minute
      },
      metrics: {
        system: true,
        operations: true,
        memory: true,
        network: false
      },
      ...options
    };

    this.setupThresholds();
    
    if (this.options.enabled) {
      this.start();
    }
  }

  private setupThresholds(): void {
    for (const threshold of this.options.thresholds) {
      this.thresholds.set(threshold.metric, threshold);
    }
  }

  start(): void {
    if (this.collectTimer) return;

    // Start metric collection
    this.collectTimer = setInterval(() => {
      this.collectMetrics();
    }, this.options.collectInterval);

    // Start dashboard if enabled
    if (this.options.dashboard.enabled) {
      this.startDashboard();
    }

    // Clean up old metrics periodically
    setInterval(() => {
      this.cleanupMetrics();
    }, 60000); // Every minute

    this.emit('started');
  }

  stop(): void {
    if (this.collectTimer) {
      clearInterval(this.collectTimer);
      this.collectTimer = undefined;
    }

    if (this.dashboardTimer) {
      clearInterval(this.dashboardTimer);
      this.dashboardTimer = undefined;
    }

    this.emit('stopped');
  }

  private async collectMetrics(): Promise<void> {
    try {
      if (this.options.metrics.system) {
        const systemMetrics = await this.collectSystemMetrics();
        this.recordSystemMetrics(systemMetrics);
      }

      // Clean up old metrics
      this.cleanupMetrics();
      
      this.emit('metrics:collected');
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const processMemory = process.memoryUsage();

    return {
      timestamp: new Date(),
      cpu: {
        usage: await this.getCpuUsage(),
        loadAverage: os.loadavg(),
        model: cpus[0]?.model || 'Unknown',
        cores: cpus.length
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        usage: (usedMemory / totalMemory) * 100,
        heap: processMemory
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        cpu: await this.getProcessCpuUsage(),
        memory: processMemory
      },
      disk: await this.getDiskUsage(),
      network: this.options.metrics.network ? await this.getNetworkStats() : undefined
    };
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        const totalTime = (endTime - startTime) * 1000; // Convert to microseconds
        
        const usage = ((endUsage.user + endUsage.system) / totalTime) * 100;
        resolve(Math.min(usage, 100));
      }, 100);
    });
  }

  private async getProcessCpuUsage(): Promise<number> {
    // Simple approximation - in real implementation, you'd track this over time
    const usage = process.cpuUsage();
    return (usage.user + usage.system) / 1000000; // Convert to seconds
  }

  private async getDiskUsage(): Promise<{ available: number; used: number; total: number; usage: number }> {
    try {
      const stats = await fs.stat(process.cwd());
      // This is a simplified version - real implementation would use statvfs or similar
      return {
        available: 0,
        used: 0,
        total: 0,
        usage: 0
      };
    } catch {
      return {
        available: 0,
        used: 0,
        total: 0,
        usage: 0
      };
    }
  }

  private async getNetworkStats(): Promise<{ connections: number; bytesReceived: number; bytesSent: number }> {
    // Placeholder - real implementation would read from /proc/net/dev or use system APIs
    return {
      connections: 0,
      bytesReceived: 0,
      bytesSent: 0
    };
  }

  private recordSystemMetrics(systemMetrics: SystemMetrics): void {
    // CPU metrics
    this.recordMetric('cpu', 'usage', systemMetrics.cpu.usage, '%', {
      model: systemMetrics.cpu.model,
      cores: systemMetrics.cpu.cores.toString()
    });

    this.recordMetric('cpu', 'load_average_1m', systemMetrics.cpu.loadAverage[0], 'load');
    this.recordMetric('cpu', 'load_average_5m', systemMetrics.cpu.loadAverage[1], 'load');
    this.recordMetric('cpu', 'load_average_15m', systemMetrics.cpu.loadAverage[2], 'load');

    // Memory metrics
    this.recordMetric('memory', 'usage', systemMetrics.memory.usage, '%');
    this.recordMetric('memory', 'total', systemMetrics.memory.total, 'bytes');
    this.recordMetric('memory', 'used', systemMetrics.memory.used, 'bytes');
    this.recordMetric('memory', 'free', systemMetrics.memory.free, 'bytes');

    // Process metrics
    this.recordMetric('process', 'heap_used', systemMetrics.process.memory.heapUsed, 'bytes');
    this.recordMetric('process', 'heap_total', systemMetrics.process.memory.heapTotal, 'bytes');
    this.recordMetric('process', 'external', systemMetrics.process.memory.external, 'bytes');
    this.recordMetric('process', 'rss', systemMetrics.process.memory.rss, 'bytes');
    this.recordMetric('process', 'uptime', systemMetrics.process.uptime, 'seconds');

    // Check thresholds
    this.checkThresholds(systemMetrics);
  }

  recordMetric(
    category: string,
    name: string,
    value: number,
    unit: string,
    tags?: Record<string, string>,
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      id: `${category}.${name}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date(),
      category,
      name,
      value,
      unit,
      tags,
      metadata
    };

    this.metrics.push(metric);
    
    // Check thresholds
    const thresholdKey = `${category}.${name}`;
    this.checkMetricThreshold(thresholdKey, metric);
    
    this.emit('metric:recorded', metric);
  }

  recordOperation(name: string, duration: number, success = true, metadata?: Record<string, any>): void {
    // Update operation counters
    const counter = this.operationCounters.get(name) || { count: 0, total: 0, errors: 0 };
    counter.count++;
    counter.total += duration;
    if (!success) counter.errors++;
    this.operationCounters.set(name, counter);

    // Record metrics
    this.recordMetric('operation', 'duration', duration, 'ms', { operation: name }, metadata);
    this.recordMetric('operation', 'count', 1, 'count', { operation: name, success: success.toString() });
    
    if (!success) {
      this.recordMetric('operation', 'error', 1, 'count', { operation: name });
    }
  }

  private checkThresholds(systemMetrics: SystemMetrics): void {
    this.checkMetricThreshold('cpu.usage', {
      id: 'cpu_usage_check',
      timestamp: new Date(),
      category: 'cpu',
      name: 'usage',
      value: systemMetrics.cpu.usage,
      unit: '%'
    });

    this.checkMetricThreshold('memory.usage', {
      id: 'memory_usage_check',
      timestamp: new Date(),
      category: 'memory',
      name: 'usage',
      value: systemMetrics.memory.usage,
      unit: '%'
    });
  }

  private checkMetricThreshold(metricKey: string, metric: PerformanceMetric): void {
    const threshold = this.thresholds.get(metricKey);
    if (!threshold || !this.options.alerting.enabled) return;

    let level: 'warning' | 'critical' | null = null;
    
    if (metric.value >= threshold.critical) {
      level = 'critical';
    } else if (metric.value >= threshold.warning) {
      level = 'warning';
    }

    if (level) {
      this.triggerAlert(level, metric, threshold);
    }
  }

  private triggerAlert(level: 'warning' | 'critical', metric: PerformanceMetric, threshold: PerformanceThreshold): void {
    const alertKey = `${metric.category}.${metric.name}_${level}`;
    const lastAlert = this.lastAlerts.get(alertKey);
    
    // Check cooldown
    if (lastAlert && Date.now() - lastAlert.getTime() < this.options.alerting.cooldown) {
      return;
    }

    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date(),
      level,
      metric,
      threshold,
      message: `${metric.category}.${metric.name} is ${metric.value}${metric.unit} (${level}: ${threshold[level]}${threshold.unit})`
    };

    this.alerts.push(alert);
    this.lastAlerts.set(alertKey, new Date());
    
    // Keep only recent alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    this.emit('alert', alert);
  }

  private cleanupMetrics(): void {
    const cutoff = Date.now() - this.options.retentionPeriod;
    this.metrics = this.metrics.filter(metric => metric.timestamp.getTime() > cutoff);
    this.alerts = this.alerts.filter(alert => alert.timestamp.getTime() > cutoff);
  }

  getDashboard(): PerformanceDashboard {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const activeAlerts = this.alerts.filter(a => now - a.timestamp.getTime() < hour);
    
    // Calculate system health
    const criticalAlerts = activeAlerts.filter(a => a.level === 'critical').length;
    const warningAlerts = activeAlerts.filter(a => a.level === 'warning').length;
    
    let systemHealth: 'good' | 'warning' | 'critical' = 'good';
    if (criticalAlerts > 0) systemHealth = 'critical';
    else if (warningAlerts > 0) systemHealth = 'warning';

    // Get recent metrics
    const recentMetrics = this.metrics.filter(m => now - m.timestamp.getTime() < hour);
    
    // Calculate operation stats
    const slowestOperations = Array.from(this.operationCounters.entries())
      .map(([name, stats]) => ({
        name,
        duration: stats.total / stats.count,
        count: stats.count
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      overview: {
        totalMetrics: this.metrics.length,
        activeAlerts: activeAlerts.length,
        systemHealth,
        uptime: Date.now() - this.startTime.getTime()
      },
      realtime: {
        cpu: this.getLatestMetricValue('cpu', 'usage') || 0,
        memory: this.getLatestMetricValue('memory', 'usage') || 0,
        operations: recentMetrics.filter(m => m.category === 'operation').length,
        errors: recentMetrics.filter(m => m.category === 'operation' && m.name === 'error').length
      },
      trends: {
        period: '1h',
        metrics: this.calculateTrends(recentMetrics)
      },
      alerts: activeAlerts.slice(-20), // Latest 20 alerts
      top: {
        slowestOperations,
        memoryConsumers: [], // TODO: Implement
        errorRate: [] // TODO: Implement
      }
    };
  }

  private getLatestMetricValue(category: string, name: string): number | null {
    const metric = this.metrics
      .filter(m => m.category === category && m.name === name)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    return metric ? metric.value : null;
  }

  private calculateTrends(metrics: PerformanceMetric[]): Array<{
    name: string;
    current: number;
    average: number;
    trend: 'up' | 'down' | 'stable';
    change: number;
  }> {
    const metricGroups = new Map<string, PerformanceMetric[]>();
    
    // Group metrics by category.name
    for (const metric of metrics) {
      const key = `${metric.category}.${metric.name}`;
      if (!metricGroups.has(key)) {
        metricGroups.set(key, []);
      }
      metricGroups.get(key)!.push(metric);
    }

    const trends = [];
    
    for (const [name, metricList] of metricGroups) {
      if (metricList.length < 2) continue;
      
      const sorted = metricList.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const current = sorted[sorted.length - 1].value;
      const average = sorted.reduce((sum, m) => sum + m.value, 0) / sorted.length;
      const previous = sorted[sorted.length - 2].value;
      
      const change = current - previous;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      
      if (Math.abs(change) > average * 0.1) { // 10% change threshold
        trend = change > 0 ? 'up' : 'down';
      }

      trends.push({
        name,
        current,
        average,
        trend,
        change: (change / previous) * 100
      });
    }

    return trends;
  }

  private startDashboard(): void {
    // Simple console-based dashboard for now
    // In a real implementation, this would start an HTTP server
    this.dashboardTimer = setInterval(() => {
      if (process.env.RESHELL_PERFORMANCE_DASHBOARD === 'console') {
        this.printConsoleDashboard();
      }
    }, this.options.dashboard.updateInterval);
  }

  private printConsoleDashboard(): void {
    const dashboard = this.getDashboard();
    
    console.clear();
    console.log('📊 Re-Shell CLI Performance Dashboard');
    console.log('=' .repeat(50));
    console.log(`System Health: ${this.getHealthEmoji(dashboard.overview.systemHealth)} ${dashboard.overview.systemHealth.toUpperCase()}`);
    console.log(`Uptime: ${Math.round(dashboard.overview.uptime / 1000)}s`);
    console.log(`Active Alerts: ${dashboard.overview.activeAlerts}`);
    console.log('');
    
    console.log('Real-time Metrics:');
    console.log(`CPU: ${dashboard.realtime.cpu.toFixed(1)}%`);
    console.log(`Memory: ${dashboard.realtime.memory.toFixed(1)}%`);
    console.log(`Operations: ${dashboard.realtime.operations}`);
    console.log(`Errors: ${dashboard.realtime.errors}`);
    console.log('');

    if (dashboard.alerts.length > 0) {
      console.log('Recent Alerts:');
      dashboard.alerts.slice(-5).forEach(alert => {
        const emoji = alert.level === 'critical' ? '🔴' : '🟡';
        console.log(`${emoji} ${alert.message}`);
      });
    }
  }

  private getHealthEmoji(health: 'good' | 'warning' | 'critical'): string {
    switch (health) {
      case 'good': return '🟢';
      case 'warning': return '🟡';
      case 'critical': return '🔴';
      default: return '⚪';
    }
  }

  // Export and persistence
  async saveMetrics(filename?: string): Promise<void> {
    const saveFile = filename || path.join(this.options.storageDir, `metrics-${Date.now()}.json`);
    await fs.ensureDir(path.dirname(saveFile));
    
    const data = {
      timestamp: new Date(),
      metrics: this.metrics,
      alerts: this.alerts,
      operations: Object.fromEntries(this.operationCounters)
    };

    await fs.writeJson(saveFile, data, { spaces: 2 });
  }

  async loadMetrics(filename: string): Promise<void> {
    const data = await fs.readJson(filename);
    this.metrics = data.metrics || [];
    this.alerts = data.alerts || [];
    this.operationCounters = new Map(Object.entries(data.operations || {}));
  }

  getMetrics(filter?: {
    category?: string;
    name?: string;
    startTime?: Date;
    endTime?: Date;
  }): PerformanceMetric[] {
    let filtered = this.metrics;

    if (filter) {
      if (filter.category) {
        filtered = filtered.filter(m => m.category === filter.category);
      }
      if (filter.name) {
        filtered = filtered.filter(m => m.name === filter.name);
      }
      if (filter.startTime) {
        filtered = filtered.filter(m => m.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        filtered = filtered.filter(m => m.timestamp <= filter.endTime!);
      }
    }

    return filtered;
  }

  getAlerts(filter?: {
    level?: 'warning' | 'critical';
    startTime?: Date;
    endTime?: Date;
  }): PerformanceAlert[] {
    let filtered = this.alerts;

    if (filter) {
      if (filter.level) {
        filtered = filtered.filter(a => a.level === filter.level);
      }
      if (filter.startTime) {
        filtered = filtered.filter(a => a.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        filtered = filtered.filter(a => a.timestamp <= filter.endTime!);
      }
    }

    return filtered;
  }

  // Configuration
  setThreshold(metric: string, warning: number, critical: number, unit: string): void {
    const threshold: PerformanceThreshold = { metric, warning, critical, unit };
    this.thresholds.set(metric, threshold);
    
    // Update options
    const existingIndex = this.options.thresholds.findIndex(t => t.metric === metric);
    if (existingIndex >= 0) {
      this.options.thresholds[existingIndex] = threshold;
    } else {
      this.options.thresholds.push(threshold);
    }
  }

  removeThreshold(metric: string): void {
    this.thresholds.delete(metric);
    this.options.thresholds = this.options.thresholds.filter(t => t.metric !== metric);
  }

  getThresholds(): PerformanceThreshold[] {
    return [...this.options.thresholds];
  }

  isEnabled(): boolean {
    return this.options.enabled;
  }

  enable(): void {
    this.options.enabled = true;
    this.start();
  }

  disable(): void {
    this.options.enabled = false;
    this.stop();
  }
}

// Global performance monitor
let globalPerformanceMonitor: PerformanceMonitor | null = null;

export function createPerformanceMonitor(options?: Partial<PerformanceOptions>): PerformanceMonitor {
  return new PerformanceMonitor(options);
}

export function getGlobalPerformanceMonitor(): PerformanceMonitor {
  if (!globalPerformanceMonitor) {
    const enabled = process.env.RESHELL_PERFORMANCE === 'true' || 
                   process.argv.includes('--profile');
    
    globalPerformanceMonitor = new PerformanceMonitor({
      enabled,
      dashboard: {
        enabled: process.env.RESHELL_PERFORMANCE_DASHBOARD === 'console',
        port: 3030,
        updateInterval: 2000
      }
    });
  }
  return globalPerformanceMonitor;
}

export function setGlobalPerformanceMonitor(monitor: PerformanceMonitor): void {
  if (globalPerformanceMonitor) {
    globalPerformanceMonitor.stop();
  }
  globalPerformanceMonitor = monitor;
}