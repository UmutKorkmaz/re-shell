/**
 * Resource usage reporting and analytics
 */
import { EventEmitter } from 'events';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface ResourceSnapshot {
  timestamp: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  operations: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  custom?: Record<string, number>;
}

interface ResourceTrend {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  rate: number; // change per minute
  confidence: number; // 0-1
}

interface ResourceAlert {
  type: 'memory' | 'cpu' | 'operations' | 'custom';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

interface ResourceReport {
  period: {
    start: number;
    end: number;
    duration: number;
  };
  summary: {
    memory: {
      peak: number;
      average: number;
      current: number;
    };
    cpu: {
      peak: number;
      average: number;
      current: number;
    };
    operations: {
      total: number;
      throughput: number; // per minute
      successRate: number;
    };
  };
  trends: ResourceTrend[];
  alerts: ResourceAlert[];
  recommendations: string[];
}

export class ResourceAnalytics extends EventEmitter {
  private static instance: ResourceAnalytics;
  private snapshots: ResourceSnapshot[] = [];
  private alerts: ResourceAlert[] = [];
  private monitoring = false;
  private interval?: NodeJS.Timeout;
  private reportPath: string;
  private lastCpuUsage: NodeJS.CpuUsage = process.cpuUsage();
  
  // Thresholds
  private readonly MEMORY_WARNING = 100; // MB
  private readonly MEMORY_CRITICAL = 200; // MB
  private readonly CPU_WARNING = 80; // %
  private readonly CPU_CRITICAL = 95; // %
  
  private constructor() {
    super();
    
    const analyticsDir = join(homedir(), '.re-shell', 'analytics');
    if (!existsSync(analyticsDir)) {
      mkdirSync(analyticsDir, { recursive: true });
    }
    
    this.reportPath = join(analyticsDir, 'resource-analytics.json');
    this.loadPersistedData();
  }
  
  static getInstance(): ResourceAnalytics {
    if (!ResourceAnalytics.instance) {
      ResourceAnalytics.instance = new ResourceAnalytics();
    }
    return ResourceAnalytics.instance;
  }
  
  /**
   * Start resource monitoring
   */
  start(intervalMs = 5000): void {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.interval = setInterval(() => {
      this.captureSnapshot();
    }, intervalMs);
    
    // Capture initial snapshot
    this.captureSnapshot();
    
    this.emit('monitoringStarted', { interval: intervalMs });
  }
  
  /**
   * Stop resource monitoring
   */
  stop(): void {
    if (!this.monitoring) return;
    
    this.monitoring = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    
    this.persistData();
    this.emit('monitoringStopped');
  }
  
  /**
   * Add custom metric to current snapshot
   */
  addCustomMetric(name: string, value: number): void {
    if (this.snapshots.length > 0) {
      const latest = this.snapshots[this.snapshots.length - 1];
      if (!latest.custom) {
        latest.custom = {};
      }
      latest.custom[name] = value;
    }
  }
  
  /**
   * Generate comprehensive resource report
   */
  generateReport(periodHours = 24): ResourceReport {
    const now = Date.now();
    const periodStart = now - (periodHours * 60 * 60 * 1000);
    
    const periodSnapshots = this.snapshots.filter(s => s.timestamp >= periodStart);
    
    if (periodSnapshots.length === 0) {
      throw new Error('No data available for the specified period');
    }
    
    const summary = this.calculateSummary(periodSnapshots);
    const trends = this.calculateTrends(periodSnapshots);
    const periodAlerts = this.alerts.filter(a => a.timestamp >= periodStart);
    const recommendations = this.generateRecommendations(summary, trends, periodAlerts);
    
    return {
      period: {
        start: periodStart,
        end: now,
        duration: now - periodStart
      },
      summary,
      trends,
      alerts: periodAlerts,
      recommendations
    };
  }
  
  /**
   * Get resource trends
   */
  getTrends(metric: string, samples = 20): ResourceTrend | null {
    if (this.snapshots.length < samples) {
      return null;
    }
    
    const recentSnapshots = this.snapshots.slice(-samples);
    const values = recentSnapshots.map(s => this.getMetricValue(s, metric));
    
    return this.calculateTrend(metric, values, recentSnapshots);
  }
  
  /**
   * Get current resource usage
   */
  getCurrentUsage(): ResourceSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }
  
  /**
   * Get resource usage history
   */
  getHistory(hours = 1): ResourceSnapshot[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.snapshots.filter(s => s.timestamp >= cutoff);
  }
  
  /**
   * Export analytics data
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      return this.exportToCsv();
    } else {
      return JSON.stringify({
        snapshots: this.snapshots,
        alerts: this.alerts,
        exported: Date.now()
      }, null, 2);
    }
  }
  
  /**
   * Clear old data
   */
  cleanup(retentionHours = 168): void { // Default 1 week
    const cutoff = Date.now() - (retentionHours * 60 * 60 * 1000);
    
    this.snapshots = this.snapshots.filter(s => s.timestamp >= cutoff);
    this.alerts = this.alerts.filter(a => a.timestamp >= cutoff);
    
    this.persistData();
    this.emit('dataCleanup', { cutoff, retained: this.snapshots.length });
  }
  
  /**
   * Capture current resource snapshot
   */
  private captureSnapshot(): void {
    const memory = process.memoryUsage();
    const currentCpu = process.cpuUsage(this.lastCpuUsage);
    this.lastCpuUsage = process.cpuUsage();
    
    // Convert to percentages (approximate)
    const cpuUser = (currentCpu.user / 1000000) * 100; // microseconds to percent
    const cpuSystem = (currentCpu.system / 1000000) * 100;
    
    const snapshot: ResourceSnapshot = {
      timestamp: Date.now(),
      memory: {
        rss: memory.rss / 1024 / 1024, // MB
        heapTotal: memory.heapTotal / 1024 / 1024,
        heapUsed: memory.heapUsed / 1024 / 1024,
        external: memory.external / 1024 / 1024,
        arrayBuffers: memory.arrayBuffers / 1024 / 1024
      },
      cpu: {
        user: cpuUser,
        system: cpuSystem
      },
      operations: {
        total: 0, // Will be updated by operation managers
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0
      }
    };
    
    this.snapshots.push(snapshot);
    
    // Keep last 1000 snapshots
    if (this.snapshots.length > 1000) {
      this.snapshots = this.snapshots.slice(-500);
    }
    
    // Check for alerts
    this.checkAlerts(snapshot);
    
    this.emit('snapshotCaptured', snapshot);
  }
  
  /**
   * Check for resource alerts
   */
  private checkAlerts(snapshot: ResourceSnapshot): void {
    const now = Date.now();
    
    // Memory alerts
    if (snapshot.memory.heapUsed > this.MEMORY_CRITICAL) {
      this.createAlert('memory', 'critical', 
        `Critical memory usage: ${snapshot.memory.heapUsed.toFixed(1)}MB`,
        snapshot.memory.heapUsed, this.MEMORY_CRITICAL, now);
    } else if (snapshot.memory.heapUsed > this.MEMORY_WARNING) {
      this.createAlert('memory', 'warning',
        `High memory usage: ${snapshot.memory.heapUsed.toFixed(1)}MB`,
        snapshot.memory.heapUsed, this.MEMORY_WARNING, now);
    }
    
    // CPU alerts
    const totalCpu = snapshot.cpu.user + snapshot.cpu.system;
    if (totalCpu > this.CPU_CRITICAL) {
      this.createAlert('cpu', 'critical',
        `Critical CPU usage: ${totalCpu.toFixed(1)}%`,
        totalCpu, this.CPU_CRITICAL, now);
    } else if (totalCpu > this.CPU_WARNING) {
      this.createAlert('cpu', 'warning',
        `High CPU usage: ${totalCpu.toFixed(1)}%`,
        totalCpu, this.CPU_WARNING, now);
    }
  }
  
  /**
   * Create and emit resource alert
   */
  private createAlert(
    type: ResourceAlert['type'],
    severity: ResourceAlert['severity'],
    message: string,
    value: number,
    threshold: number,
    timestamp: number
  ): void {
    // Don't spam alerts - check if similar alert was created recently
    const recentAlerts = this.alerts.filter(a => 
      a.type === type && 
      a.severity === severity && 
      timestamp - a.timestamp < 60000 // 1 minute
    );
    
    if (recentAlerts.length > 0) return;
    
    const alert: ResourceAlert = {
      type,
      severity,
      message,
      value,
      threshold,
      timestamp
    };
    
    this.alerts.push(alert);
    this.emit('resourceAlert', alert);
  }
  
  /**
   * Calculate summary statistics
   */
  private calculateSummary(snapshots: ResourceSnapshot[]): ResourceReport['summary'] {
    const memoryValues = snapshots.map(s => s.memory.heapUsed);
    const cpuValues = snapshots.map(s => s.cpu.user + s.cpu.system);
    const operationsTotal = snapshots.reduce((sum, s) => sum + s.operations.total, 0);
    
    return {
      memory: {
        peak: Math.max(...memoryValues),
        average: memoryValues.reduce((sum, v) => sum + v, 0) / memoryValues.length,
        current: memoryValues[memoryValues.length - 1] || 0
      },
      cpu: {
        peak: Math.max(...cpuValues),
        average: cpuValues.reduce((sum, v) => sum + v, 0) / cpuValues.length,
        current: cpuValues[cpuValues.length - 1] || 0
      },
      operations: {
        total: operationsTotal,
        throughput: operationsTotal / (snapshots.length * 5 / 60), // per minute
        successRate: 0 // Would need to be calculated based on actual operation data
      }
    };
  }
  
  /**
   * Calculate trends for metrics
   */
  private calculateTrends(snapshots: ResourceSnapshot[]): ResourceTrend[] {
    const trends: ResourceTrend[] = [];
    
    const metrics = ['memory.heapUsed', 'cpu.total', 'operations.total'];
    
    for (const metric of metrics) {
      const values = snapshots.map(s => this.getMetricValue(s, metric));
      const trend = this.calculateTrend(metric, values, snapshots);
      if (trend) {
        trends.push(trend);
      }
    }
    
    return trends;
  }
  
  /**
   * Calculate trend for a specific metric
   */
  private calculateTrend(
    metric: string,
    values: number[],
    snapshots: ResourceSnapshot[]
  ): ResourceTrend | null {
    if (values.length < 2) return null;
    
    // Simple linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const ssTotal = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const ssRes = y.reduce((sum, val, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (ssRes / ssTotal);
    
    // Convert slope to rate per minute
    const timespan = snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp;
    const ratePerMinute = slope * (60000 / (timespan / n));
    
    let direction: ResourceTrend['direction'];
    if (Math.abs(ratePerMinute) < 0.01) {
      direction = 'stable';
    } else if (ratePerMinute > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }
    
    return {
      metric,
      direction,
      rate: Math.abs(ratePerMinute),
      confidence: Math.max(0, Math.min(1, rSquared))
    };
  }
  
  /**
   * Get metric value from snapshot
   */
  private getMetricValue(snapshot: ResourceSnapshot, metric: string): number {
    const parts = metric.split('.');
    
    switch (parts[0]) {
      case 'memory':
        return (snapshot.memory as any)[parts[1]] || 0;
      case 'cpu':
        if (parts[1] === 'total') {
          return snapshot.cpu.user + snapshot.cpu.system;
        }
        return (snapshot.cpu as any)[parts[1]] || 0;
      case 'operations':
        return (snapshot.operations as any)[parts[1]] || 0;
      default:
        return snapshot.custom?.[metric] || 0;
    }
  }
  
  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    summary: ResourceReport['summary'],
    trends: ResourceTrend[],
    alerts: ResourceAlert[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Memory recommendations
    if (summary.memory.peak > this.MEMORY_WARNING) {
      recommendations.push('Consider optimizing memory usage or increasing available memory');
    }
    
    const memoryTrend = trends.find(t => t.metric === 'memory.heapUsed');
    if (memoryTrend?.direction === 'increasing' && memoryTrend.confidence > 0.7) {
      recommendations.push('Memory usage is consistently increasing - check for memory leaks');
    }
    
    // CPU recommendations
    if (summary.cpu.peak > this.CPU_WARNING) {
      recommendations.push('High CPU usage detected - consider optimizing compute-intensive operations');
    }
    
    // Alert-based recommendations
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push('Critical resource alerts detected - immediate attention required');
    }
    
    return recommendations;
  }
  
  /**
   * Export data to CSV format
   */
  private exportToCsv(): string {
    const headers = [
      'timestamp',
      'memory_rss',
      'memory_heap_used',
      'memory_heap_total',
      'cpu_user',
      'cpu_system',
      'operations_total',
      'operations_pending',
      'operations_running'
    ];
    
    const rows = this.snapshots.map(s => [
      s.timestamp,
      s.memory.rss,
      s.memory.heapUsed,
      s.memory.heapTotal,
      s.cpu.user,
      s.cpu.system,
      s.operations.total,
      s.operations.pending,
      s.operations.running
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
  
  /**
   * Load persisted analytics data
   */
  private loadPersistedData(): void {
    if (!existsSync(this.reportPath)) return;
    
    try {
      const data = JSON.parse(readFileSync(this.reportPath, 'utf-8'));
      
      // Load last 100 snapshots
      if (data.snapshots && Array.isArray(data.snapshots)) {
        this.snapshots = data.snapshots.slice(-100);
      }
      
      // Load recent alerts (last 24 hours)
      if (data.alerts && Array.isArray(data.alerts)) {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000);
        this.alerts = data.alerts.filter((a: ResourceAlert) => a.timestamp >= cutoff);
      }
    } catch (error) {
      // Ignore errors loading persisted data
    }
  }
  
  /**
   * Persist analytics data
   */
  private persistData(): void {
    try {
      const data = {
        snapshots: this.snapshots.slice(-100), // Keep last 100
        alerts: this.alerts.slice(-50), // Keep last 50
        lastUpdated: Date.now()
      };
      
      writeFileSync(this.reportPath, JSON.stringify(data, null, 2));
    } catch (error) {
      // Ignore errors persisting data
    }
  }
}

// Export singleton instance
export const resourceAnalytics = ResourceAnalytics.getInstance();