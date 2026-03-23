/**
 * Memory usage monitoring and optimization alerts
 */
import { EventEmitter } from 'events';

interface MemoryAlert {
  type: 'warning' | 'critical';
  threshold: number;
  current: number;
  timestamp: number;
  suggestion?: string;
}

interface MemoryStats {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

export class MemoryMonitor extends EventEmitter {
  private static instance: MemoryMonitor;
  private monitoring = false;
  private interval?: NodeJS.Timeout;
  private history: MemoryStats[] = [];
  private alerts: MemoryAlert[] = [];
  
  // Thresholds in MB
  private readonly WARNING_HEAP = 50;
  private readonly CRITICAL_HEAP = 100;
  private readonly WARNING_RSS = 150;
  private readonly CRITICAL_RSS = 250;
  
  private constructor() {
    super();
    this.setupGCHooks();
  }
  
  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }
  
  /**
   * Start memory monitoring
   */
  start(intervalMs = 10000): void {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.interval = setInterval(() => {
      this.checkMemory();
    }, intervalMs);
    
    // Initial check
    this.checkMemory();
  }
  
  /**
   * Stop memory monitoring
   */
  stop(): void {
    if (!this.monitoring) return;
    
    this.monitoring = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
  
  /**
   * Get current memory usage
   */
  getCurrentMemory(): MemoryStats {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss / 1024 / 1024, // MB
      heapTotal: usage.heapTotal / 1024 / 1024,
      heapUsed: usage.heapUsed / 1024 / 1024,
      external: usage.external / 1024 / 1024,
      arrayBuffers: usage.arrayBuffers / 1024 / 1024
    };
  }
  
  /**
   * Get formatted memory usage string
   */
  getFormattedMemory(): string {
    const mem = this.getCurrentMemory();
    return `RSS: ${mem.rss.toFixed(1)}MB, ` +
           `Heap: ${mem.heapUsed.toFixed(1)}/${mem.heapTotal.toFixed(1)}MB, ` +
           `External: ${mem.external.toFixed(1)}MB, ` +
           `ArrayBuffers: ${mem.arrayBuffers.toFixed(1)}MB`;
  }
  
  /**
   * Get memory usage trend
   */
  getMemoryTrend(samples = 10): 'increasing' | 'decreasing' | 'stable' {
    if (this.history.length < samples) {
      return 'stable';
    }
    
    const recent = this.history.slice(-samples);
    const first = recent[0].heapUsed;
    const last = recent[recent.length - 1].heapUsed;
    const threshold = 2; // MB
    
    if (last - first > threshold) {
      return 'increasing';
    } else if (first - last > threshold) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }
  
  /**
   * Get memory statistics
   */
  getStats(): {
    current: MemoryStats;
    peak: MemoryStats;
    average: MemoryStats;
    trend: string;
    alerts: number;
  } {
    const current = this.getCurrentMemory();
    
    if (this.history.length === 0) {
      return {
        current,
        peak: current,
        average: current,
        trend: 'stable',
        alerts: this.alerts.length
      };
    }
    
    const peak = this.history.reduce((max, curr) => ({
      rss: Math.max(max.rss, curr.rss),
      heapTotal: Math.max(max.heapTotal, curr.heapTotal),
      heapUsed: Math.max(max.heapUsed, curr.heapUsed),
      external: Math.max(max.external, curr.external),
      arrayBuffers: Math.max(max.arrayBuffers, curr.arrayBuffers)
    }));
    
    const sum = this.history.reduce((acc, curr) => ({
      rss: acc.rss + curr.rss,
      heapTotal: acc.heapTotal + curr.heapTotal,
      heapUsed: acc.heapUsed + curr.heapUsed,
      external: acc.external + curr.external,
      arrayBuffers: acc.arrayBuffers + curr.arrayBuffers
    }));
    
    const count = this.history.length;
    const average = {
      rss: sum.rss / count,
      heapTotal: sum.heapTotal / count,
      heapUsed: sum.heapUsed / count,
      external: sum.external / count,
      arrayBuffers: sum.arrayBuffers / count
    };
    
    return {
      current,
      peak,
      average,
      trend: this.getMemoryTrend(),
      alerts: this.alerts.length
    };
  }
  
  /**
   * Force garbage collection if available
   */
  forceGC(): boolean {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  }
  
  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const current = this.getCurrentMemory();
    const trend = this.getMemoryTrend();
    
    if (current.heapUsed > this.WARNING_HEAP) {
      suggestions.push('Consider reducing object retention or running garbage collection');
    }
    
    if (current.external > 20) {
      suggestions.push('High external memory usage detected - check for large buffers');
    }
    
    if (current.arrayBuffers > 10) {
      suggestions.push('High ArrayBuffer usage - ensure proper cleanup');
    }
    
    if (trend === 'increasing') {
      suggestions.push('Memory usage is trending upward - check for memory leaks');
    }
    
    if (this.history.length > 5) {
      const recentLeaks = this.detectMemoryLeaks();
      if (recentLeaks) {
        suggestions.push('Potential memory leak detected in recent activity');
      }
    }
    
    if (!global.gc) {
      suggestions.push('Run with --expose-gc flag to enable manual garbage collection');
    }
    
    return suggestions;
  }
  
  /**
   * Check memory and emit alerts if needed
   */
  private checkMemory(): void {
    const current = this.getCurrentMemory();
    
    // Store in history (keep last 100 samples)
    this.history.push(current);
    if (this.history.length > 100) {
      this.history.shift();
    }
    
    // Check for alerts
    this.checkThresholds(current);
    
    // Emit memory update event
    this.emit('memoryUpdate', current);
  }
  
  /**
   * Check memory thresholds and create alerts
   */
  private checkThresholds(current: MemoryStats): void {
    const now = Date.now();
    
    // Heap usage alerts
    if (current.heapUsed > this.CRITICAL_HEAP) {
      this.createAlert('critical', this.CRITICAL_HEAP, current.heapUsed, now,
        'Critical heap usage - consider memory optimization');
    } else if (current.heapUsed > this.WARNING_HEAP) {
      this.createAlert('warning', this.WARNING_HEAP, current.heapUsed, now,
        'High heap usage detected');
    }
    
    // RSS alerts
    if (current.rss > this.CRITICAL_RSS) {
      this.createAlert('critical', this.CRITICAL_RSS, current.rss, now,
        'Critical RSS usage - system memory pressure');
    } else if (current.rss > this.WARNING_RSS) {
      this.createAlert('warning', this.WARNING_RSS, current.rss, now,
        'High RSS usage detected');
    }
  }
  
  /**
   * Create and emit memory alert
   */
  private createAlert(
    type: 'warning' | 'critical',
    threshold: number,
    current: number,
    timestamp: number,
    suggestion?: string
  ): void {
    const alert: MemoryAlert = {
      type,
      threshold,
      current,
      timestamp,
      suggestion
    };
    
    // Don't spam alerts - only emit if last alert was >30s ago
    const lastAlert = this.alerts[this.alerts.length - 1];
    if (!lastAlert || timestamp - lastAlert.timestamp > 30000) {
      this.alerts.push(alert);
      this.emit('memoryAlert', alert);
      
      // Auto-GC on critical alerts
      if (type === 'critical' && global.gc) {
        this.forceGC();
        console.warn('Critical memory usage detected, forced garbage collection');
      }
    }
  }
  
  /**
   * Detect potential memory leaks
   */
  private detectMemoryLeaks(): boolean {
    if (this.history.length < 10) return false;
    
    const recent = this.history.slice(-10);
    const older = this.history.slice(-20, -10);
    
    if (older.length === 0) return false;
    
    const recentAvg = recent.reduce((sum, mem) => sum + mem.heapUsed, 0) / recent.length;
    const olderAvg = older.reduce((sum, mem) => sum + mem.heapUsed, 0) / older.length;
    
    // Consider it a leak if average increased by >10MB
    return recentAvg - olderAvg > 10;
  }
  
  /**
   * Setup garbage collection hooks if available
   */
  private setupGCHooks(): void {
    if (process.versions && process.versions.v8) {
      try {
        // Listen for GC events if available
        process.on('exit', () => {
          if (this.monitoring) {
            this.stop();
          }
        });
      } catch {
        // Ignore if not available
      }
    }
  }
}

// Export singleton instance
export const memoryMonitor = MemoryMonitor.getInstance();