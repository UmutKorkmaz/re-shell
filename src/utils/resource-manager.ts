/**
 * Resource management and cleanup utilities
 */

interface ResourceTracker {
  type: string;
  resource: any;
  cleanup: () => void | Promise<void>;
  timestamp: number;
}

export class ResourceManager {
  private static instance: ResourceManager;
  private resources: Map<string, ResourceTracker> = new Map();
  private memoryMonitor?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  
  private constructor() {
    this.setupEventHandlers();
    this.startMemoryMonitoring();
    this.startPeriodicCleanup();
  }
  
  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }
  
  /**
   * Register a resource for tracking and cleanup
   */
  register(id: string, type: string, resource: any, cleanup: () => void | Promise<void>): void {
    this.resources.set(id, {
      type,
      resource,
      cleanup,
      timestamp: Date.now()
    });
  }
  
  /**
   * Unregister and cleanup a specific resource
   */
  async unregister(id: string): Promise<void> {
    const tracker = this.resources.get(id);
    if (tracker) {
      try {
        await tracker.cleanup();
      } catch (error) {
        if (process.env.DEBUG) {
          console.error(`Failed to cleanup resource ${id}:`, error);
        }
      }
      this.resources.delete(id);
    }
  }
  
  /**
   * Get current memory usage
   */
  getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }
  
  /**
   * Get memory usage in human readable format
   */
  getFormattedMemoryUsage(): string {
    const usage = this.getMemoryUsage();
    const formatMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)}MB`;
    
    return `Heap: ${formatMB(usage.heapUsed)}/${formatMB(usage.heapTotal)}, ` +
           `RSS: ${formatMB(usage.rss)}, External: ${formatMB(usage.external)}`;
  }
  
  /**
   * Force garbage collection if available
   */
  forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }
  
  /**
   * Check if memory usage is high
   */
  isMemoryHigh(): boolean {
    const usage = this.getMemoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    
    // Consider memory high if heap usage > 100MB
    return heapUsedMB > 100;
  }
  
  /**
   * Get resource statistics
   */
  getResourceStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    
    for (const tracker of this.resources.values()) {
      byType[tracker.type] = (byType[tracker.type] || 0) + 1;
    }
    
    return {
      total: this.resources.size,
      byType
    };
  }
  
  /**
   * Cleanup old or unused resources
   */
  async cleanupOldResources(maxAge = 3600000): Promise<void> {
    const now = Date.now();
    const toCleanup: string[] = [];
    
    for (const [id, tracker] of this.resources) {
      if (now - tracker.timestamp > maxAge) {
        toCleanup.push(id);
      }
    }
    
    for (const id of toCleanup) {
      await this.unregister(id);
    }
  }
  
  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];
    
    for (const [id, tracker] of this.resources) {
      cleanupPromises.push(
        (async () => {
          try {
            await tracker.cleanup();
          } catch (error) {
            if (process.env.DEBUG) {
              console.error(`Failed to cleanup resource ${id}:`, error);
            }
          }
        })()
      );
    }
    
    await Promise.all(cleanupPromises);
    this.resources.clear();
    
    // Stop monitoring
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
  
  /**
   * Setup event handlers for graceful shutdown
   */
  private setupEventHandlers(): void {
    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(130);
    });

    process.on('SIGTERM', async () => {
      await this.cleanup();
      process.exit(143);
    });
    process.on('exit', () => {
      // Synchronous cleanup only
      for (const tracker of this.resources.values()) {
        try {
          const result = tracker.cleanup();
          if (result && typeof result.then === 'function') {
            // Can't wait for async cleanup on exit
            console.warn('Async cleanup detected on exit, may not complete');
          }
        } catch {
          // Ignore cleanup errors on exit
        }
      }
    });
  }
  
  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      this.memoryMonitor = setInterval(() => {
        if (this.isMemoryHigh()) {
          console.warn(`High memory usage detected: ${this.getFormattedMemoryUsage()}`);
          
          // Force GC if available
          this.forceGC();
          
          // Cleanup old resources
          this.cleanupOldResources(1800000); // 30 minutes
        }
      }, 30000); // Check every 30 seconds
    }
  }
  
  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldResources();
    }, 300000); // Cleanup every 5 minutes
  }
}

// Utility functions for common resource types
export const resourceManager = ResourceManager.getInstance();

/**
 * Track a file watcher
 */
export function trackFileWatcher(id: string, watcher: any): void {
  resourceManager.register(id, 'file-watcher', watcher, () => {
    if (watcher && typeof watcher.close === 'function') {
      watcher.close();
    }
  });
}

/**
 * Track a timer
 */
export function trackTimer(id: string, timer: NodeJS.Timeout): void {
  resourceManager.register(id, 'timer', timer, () => {
    clearTimeout(timer);
  });
}

/**
 * Track an interval
 */
export function trackInterval(id: string, interval: NodeJS.Timeout): void {
  resourceManager.register(id, 'interval', interval, () => {
    clearInterval(interval);
  });
}

/**
 * Track a process
 */
export function trackProcess(id: string, proc: any): void {
  resourceManager.register(id, 'process', proc, () => {
    if (proc && typeof proc.kill === 'function') {
      proc.kill();
    }
  });
}

/**
 * Track a server
 */
export function trackServer(id: string, server: any): void {
  resourceManager.register(id, 'server', server, () => {
    return new Promise<void>((resolve) => {
      if (server && typeof server.close === 'function') {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
  });
}