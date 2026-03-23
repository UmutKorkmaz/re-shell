import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { ValidationError } from './error-handler';

// Platform detection and file watching capabilities
export interface PlatformCapabilities {
  platform: NodeJS.Platform;
  architecture: string;
  supportsNativeWatching: boolean;
  supportsPolling: boolean;
  supportsFSEvents: boolean;
  supportsInotify: boolean;
  maxWatchedFiles: number;
  recommendedWatchMethod: WatchMethod;
  fallbackMethods: WatchMethod[];
  limitations: string[];
}

export type WatchMethod = 'native' | 'polling' | 'fsevents' | 'inotify' | 'hybrid';

export interface WatcherFallbackOptions {
  primaryMethod: WatchMethod;
  fallbackMethods: WatchMethod[];
  fallbackDelay: number;
  maxRetries: number;
  healthCheckInterval: number;
  enableFallbackLogging: boolean;
  platformOptimizations: boolean;
  adaptivePolling: boolean;
}

export interface PlatformWatchOptions {
  usePolling?: boolean;
  interval?: number;
  binaryInterval?: number;
  useNativeWatcher?: boolean;
  enableFallbacks?: boolean;
  fallbackOptions?: Partial<WatcherFallbackOptions>;
  platformSpecific?: {
    darwin?: any;
    linux?: any;
    win32?: any;
    [key: string]: any;
  };
}

// Cross-platform file watcher with intelligent fallbacks
export class PlatformWatcher extends EventEmitter {
  private capabilities: PlatformCapabilities;
  private activeWatchers: Map<string, chokidar.FSWatcher> = new Map();
  private fallbackWatchers: Map<string, chokidar.FSWatcher> = new Map();
  private watcherHealth: Map<string, WatcherHealthStatus> = new Map();
  private fallbackOptions: WatcherFallbackOptions;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isActive = false;

  constructor(fallbackOptions: Partial<WatcherFallbackOptions> = {}) {
    super();
    this.capabilities = this.detectPlatformCapabilities();
    this.fallbackOptions = {
      primaryMethod: this.capabilities.recommendedWatchMethod,
      fallbackMethods: this.capabilities.fallbackMethods,
      fallbackDelay: 5000,
      maxRetries: 3,
      healthCheckInterval: 30000,
      enableFallbackLogging: true,
      platformOptimizations: true,
      adaptivePolling: true,
      ...fallbackOptions
    };

    this.setupHealthChecking();
  }

  // Detect platform capabilities and limitations
  private detectPlatformCapabilities(): PlatformCapabilities {
    const platform = os.platform();
    const arch = os.arch();
    
    const baseCapabilities: PlatformCapabilities = {
      platform,
      architecture: arch,
      supportsNativeWatching: true,
      supportsPolling: true,
      supportsFSEvents: false,
      supportsInotify: false,
      maxWatchedFiles: 8192,
      recommendedWatchMethod: 'native',
      fallbackMethods: ['polling'],
      limitations: []
    };

    switch (platform) {
      case 'darwin': // macOS
        return {
          ...baseCapabilities,
          supportsFSEvents: true,
          maxWatchedFiles: 524288, // Higher limit on macOS
          recommendedWatchMethod: 'fsevents',
          fallbackMethods: ['native', 'polling'],
          limitations: [
            'FSEvents may have latency with network drives',
            'Case sensitivity issues on case-insensitive filesystems'
          ]
        };

      case 'linux':
        return {
          ...baseCapabilities,
          supportsInotify: true,
          maxWatchedFiles: this.getLinuxMaxWatchedFiles(),
          recommendedWatchMethod: 'inotify',
          fallbackMethods: ['native', 'polling'],
          limitations: [
            'inotify watch limit may be exceeded with large projects',
            'NFS and some network filesystems may not work reliably'
          ]
        };

      case 'win32': // Windows
        return {
          ...baseCapabilities,
          maxWatchedFiles: 65536,
          recommendedWatchMethod: 'native',
          fallbackMethods: ['polling'],
          limitations: [
            'Path length limitations (260 characters)',
            'Case insensitive filesystem',
            'Some antivirus software may interfere'
          ]
        };

      case 'freebsd':
      case 'openbsd':
      case 'netbsd':
        return {
          ...baseCapabilities,
          maxWatchedFiles: 4096,
          recommendedWatchMethod: 'polling',
          fallbackMethods: ['native'],
          limitations: [
            'Limited native watching support',
            'Polling recommended for reliability'
          ]
        };

      default:
        return {
          ...baseCapabilities,
          maxWatchedFiles: 1024,
          recommendedWatchMethod: 'polling',
          fallbackMethods: ['native'],
          limitations: [
            'Unknown platform - using conservative defaults',
            'Native watching may not be reliable'
          ]
        };
    }
  }

  // Get Linux inotify limits
  private getLinuxMaxWatchedFiles(): number {
    try {
      const maxUserWatches = fs.readFileSync('/proc/sys/fs/inotify/max_user_watches', 'utf8');
      return parseInt(maxUserWatches.trim(), 10) || 8192;
    } catch {
      return 8192; // Default fallback
    }
  }

  // Create platform-optimized watcher
  async createWatcher(
    watchPath: string,
    options: PlatformWatchOptions = {}
  ): Promise<chokidar.FSWatcher> {
    const watcherId = this.generateWatcherId(watchPath);
    
    try {
      // Apply platform optimizations
      const optimizedOptions = this.applyPlatformOptimizations(options);
      
      // Create primary watcher
      const watcher = await this.createPrimaryWatcher(watchPath, optimizedOptions);
      
      // Set up health monitoring
      this.setupWatcherHealthMonitoring(watcherId, watcher, watchPath);
      
      // Store watcher
      this.activeWatchers.set(watcherId, watcher);
      
      // Set up fallback if enabled
      if (options.enableFallbacks !== false) {
        await this.setupFallbackWatcher(watcherId, watchPath, optimizedOptions);
      }
      
      this.emit('watcher-created', { watcherId, watchPath, method: this.fallbackOptions.primaryMethod });
      
      return watcher;
      
    } catch (error) {
      this.emit('watcher-error', { watcherId, watchPath, error });
      
      // Try fallback methods
      if (options.enableFallbacks !== false) {
        return this.createFallbackWatcher(watcherId, watchPath, options);
      }
      
      throw new ValidationError(
        `Failed to create watcher for ${watchPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Apply platform-specific optimizations
  private applyPlatformOptimizations(options: PlatformWatchOptions): any {
    const baseOptions: any = {
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      ignorePermissionErrors: true,
      atomic: true
    };

    // Platform-specific optimizations
    const platformOptions = options.platformSpecific?.[this.capabilities.platform] || {};
    
    switch (this.capabilities.platform) {
      case 'darwin':
        return {
          ...baseOptions,
          usePolling: options.usePolling || false,
          interval: options.interval || 1000,
          binaryInterval: options.binaryInterval || 3000,
          alwaysStat: false, // FSEvents provides stat info
          awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100
          },
          ...platformOptions,
          ...options
        };

      case 'linux':
        return {
          ...baseOptions,
          usePolling: options.usePolling || false,
          interval: options.interval || 1000,
          binaryInterval: options.binaryInterval || 3000,
          alwaysStat: true, // inotify needs stat calls
          awaitWriteFinish: {
            stabilityThreshold: 1000,
            pollInterval: 100
          },
          ...platformOptions,
          ...options
        };

      case 'win32':
        return {
          ...baseOptions,
          usePolling: options.usePolling || false,
          interval: options.interval || 1000,
          binaryInterval: options.binaryInterval || 3000,
          alwaysStat: true,
          awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100
          },
          ...platformOptions,
          ...options
        };

      default:
        return {
          ...baseOptions,
          usePolling: options.usePolling || true, // Default to polling for unknown platforms
          interval: options.interval || 2000,
          binaryInterval: options.binaryInterval || 5000,
          alwaysStat: true,
          ...platformOptions,
          ...options
        };
    }
  }

  // Create primary watcher with method detection
  private async createPrimaryWatcher(
    watchPath: string,
    options: any
  ): Promise<chokidar.FSWatcher> {
    const method = this.fallbackOptions.primaryMethod;
    
    switch (method) {
      case 'fsevents':
        if (!this.capabilities.supportsFSEvents) {
          throw new Error('FSEvents not supported on this platform');
        }
        return chokidar.watch(watchPath, { ...options, usePolling: false });

      case 'inotify':
        if (!this.capabilities.supportsInotify) {
          throw new Error('inotify not supported on this platform');
        }
        return chokidar.watch(watchPath, { ...options, usePolling: false });

      case 'polling':
        return chokidar.watch(watchPath, { 
          ...options, 
          usePolling: true,
          interval: this.getAdaptivePollingInterval(watchPath)
        });

      case 'hybrid':
        return this.createHybridWatcher(watchPath, options);

      case 'native':
      default:
        return chokidar.watch(watchPath, { ...options, usePolling: false });
    }
  }

  // Create hybrid watcher (combines multiple methods)
  private async createHybridWatcher(
    watchPath: string,
    options: any
  ): Promise<chokidar.FSWatcher> {
    // For now, hybrid mode uses native with polling fallback
    // This could be enhanced to run multiple watchers simultaneously
    try {
      return chokidar.watch(watchPath, { ...options, usePolling: false });
    } catch (error) {
      if (this.fallbackOptions.enableFallbackLogging) {
        console.warn(`Hybrid watcher falling back to polling for ${watchPath}: ${error}`);
      }
      return chokidar.watch(watchPath, { ...options, usePolling: true });
    }
  }

  // Setup fallback watcher
  private async setupFallbackWatcher(
    watcherId: string,
    watchPath: string,
    options: any
  ): Promise<void> {
    // Prepare fallback but don't activate unless primary fails
    const fallbackMethod = this.fallbackOptions.fallbackMethods[0];
    if (!fallbackMethod) return;

    try {
      // Create fallback options
      const fallbackOptions: any = {
        ...options,
        usePolling: fallbackMethod === 'polling'
      };

      // Store fallback configuration for later activation
      this.watcherHealth.set(watcherId, {
        isHealthy: true,
        lastCheck: Date.now(),
        failureCount: 0,
        fallbackReady: true,
        fallbackOptions: { watchPath, options: fallbackOptions }
      });

    } catch (error) {
      if (this.fallbackOptions.enableFallbackLogging) {
        console.warn(`Failed to prepare fallback watcher for ${watchPath}: ${error}`);
      }
    }
  }

  // Create fallback watcher when primary fails
  private async createFallbackWatcher(
    watcherId: string,
    watchPath: string,
    options: PlatformWatchOptions
  ): Promise<chokidar.FSWatcher> {
    const fallbackMethods = this.fallbackOptions.fallbackMethods;
    
    for (const method of fallbackMethods) {
      try {
        if (this.fallbackOptions.enableFallbackLogging) {
          console.log(`Attempting fallback watcher method: ${method} for ${watchPath}`);
        }

        let fallbackOptions: any;
        
        switch (method) {
          case 'polling':
            fallbackOptions = {
              ...this.applyPlatformOptimizations(options),
              usePolling: true,
              interval: this.getAdaptivePollingInterval(watchPath)
            };
            break;
            
          case 'native':
            fallbackOptions = {
              ...this.applyPlatformOptimizations(options),
              usePolling: false
            };
            break;
            
          default:
            fallbackOptions = this.applyPlatformOptimizations(options);
        }

        const watcher = chokidar.watch(watchPath, fallbackOptions);
        
        // Store as fallback watcher
        this.fallbackWatchers.set(watcherId, watcher);
        this.activeWatchers.set(watcherId, watcher);
        
        this.emit('fallback-activated', { watcherId, watchPath, method });
        
        return watcher;
        
      } catch (error) {
        if (this.fallbackOptions.enableFallbackLogging) {
          console.warn(`Fallback method ${method} failed for ${watchPath}: ${error}`);
        }
        continue;
      }
    }
    
    throw new ValidationError(`All fallback methods failed for ${watchPath}`);
  }

  // Get adaptive polling interval based on directory size
  private getAdaptivePollingInterval(watchPath: string): number {
    if (!this.fallbackOptions.adaptivePolling) {
      return 1000; // Default 1 second
    }

    try {
      // Estimate directory complexity
      const stats = fs.statSync(watchPath);
      if (stats.isFile()) {
        return 500; // Fast polling for single files
      }

      // For directories, estimate based on size heuristics
      // This is a simple implementation - could be more sophisticated
      const entries = fs.readdirSync(watchPath);
      const fileCount = entries.length;

      if (fileCount < 50) {
        return 500; // Small directory - fast polling
      } else if (fileCount < 200) {
        return 1000; // Medium directory - normal polling
      } else {
        return 2000; // Large directory - slower polling
      }
      
    } catch (error) {
      return 1000; // Default on error
    }
  }

  // Setup watcher health monitoring
  private setupWatcherHealthMonitoring(
    watcherId: string,
    watcher: chokidar.FSWatcher,
    watchPath: string
  ): void {
    const health: WatcherHealthStatus = {
      isHealthy: true,
      lastCheck: Date.now(),
      failureCount: 0,
      fallbackReady: false
    };

    this.watcherHealth.set(watcherId, health);

    // Monitor watcher events for health
    watcher.on('error', (error) => {
      health.isHealthy = false;
      health.failureCount++;
      health.lastError = error;
      
      this.emit('watcher-unhealthy', { watcherId, watchPath, error, failureCount: health.failureCount });
      
      // Trigger fallback if failure count exceeds threshold
      if (health.failureCount >= this.fallbackOptions.maxRetries) {
        this.activateFallback(watcherId, watchPath).catch(err => {
          this.emit('fallback-failed', { watcherId, watchPath, error: err });
        });
      }
    });

    watcher.on('ready', () => {
      health.isHealthy = true;
      health.lastCheck = Date.now();
      health.failureCount = 0;
      delete health.lastError;
    });
  }

  // Activate fallback watcher
  private async activateFallback(watcherId: string, watchPath: string): Promise<void> {
    const health = this.watcherHealth.get(watcherId);
    if (!health?.fallbackReady || !health.fallbackOptions) {
      throw new Error('No fallback available');
    }

    try {
      // Close primary watcher
      const primaryWatcher = this.activeWatchers.get(watcherId);
      if (primaryWatcher) {
        await primaryWatcher.close();
      }

      // Create and activate fallback
      const fallbackWatcher = await this.createFallbackWatcher(
        watcherId,
        health.fallbackOptions.watchPath,
        health.fallbackOptions.options as PlatformWatchOptions
      );

      this.activeWatchers.set(watcherId, fallbackWatcher);
      
      if (this.fallbackOptions.enableFallbackLogging) {
        console.log(`Activated fallback watcher for ${watchPath}`);
      }

    } catch (error) {
      throw new ValidationError(`Failed to activate fallback for ${watchPath}: ${error}`);
    }
  }

  // Setup periodic health checking
  private setupHealthChecking(): void {
    if (this.fallbackOptions.healthCheckInterval <= 0) return;

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.fallbackOptions.healthCheckInterval);
  }

  // Perform health check on all watchers
  private performHealthCheck(): void {
    const now = Date.now();
    
    for (const [watcherId, health] of this.watcherHealth.entries()) {
      health.lastCheck = now;
      
      // Check if watcher is responsive
      const watcher = this.activeWatchers.get(watcherId);
      if (!watcher) {
        health.isHealthy = false;
        continue;
      }

      // Simple health check - could be enhanced with actual file system operations
      try {
        // If watcher has listeners and hasn't errored recently, consider it healthy
        const hasListeners = watcher.listenerCount('change') > 0 || 
                           watcher.listenerCount('add') > 0 || 
                           watcher.listenerCount('unlink') > 0;
        
        if (hasListeners && !health.lastError) {
          health.isHealthy = true;
          health.failureCount = Math.max(0, health.failureCount - 1); // Slowly recover
        }
      } catch (error) {
        health.isHealthy = false;
        health.failureCount++;
        health.lastError = error;
      }
    }

    this.emit('health-check-completed', {
      totalWatchers: this.watcherHealth.size,
      healthyWatchers: Array.from(this.watcherHealth.values()).filter(h => h.isHealthy).length
    });
  }

  // Get platform capabilities
  getPlatformCapabilities(): PlatformCapabilities {
    return { ...this.capabilities };
  }

  // Get watcher health status
  getWatcherHealth(watcherId?: string): Map<string, WatcherHealthStatus> | WatcherHealthStatus | null {
    if (watcherId) {
      return this.watcherHealth.get(watcherId) || null;
    }
    return new Map(this.watcherHealth);
  }

  // Get active watchers count
  getActiveWatchersCount(): number {
    return this.activeWatchers.size;
  }

  // Close all watchers
  async closeAll(): Promise<void> {
    this.isActive = false;

    // Clear health check timer
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Close all active watchers
    const closePromises: Promise<void>[] = [];
    
    for (const [watcherId, watcher] of this.activeWatchers.entries()) {
      closePromises.push(
        watcher.close().catch(error => {
          console.warn(`Error closing watcher ${watcherId}: ${error}`);
        })
      );
    }

    // Close fallback watchers
    for (const [watcherId, watcher] of this.fallbackWatchers.entries()) {
      closePromises.push(
        watcher.close().catch(error => {
          console.warn(`Error closing fallback watcher ${watcherId}: ${error}`);
        })
      );
    }

    await Promise.all(closePromises);

    // Clear all maps
    this.activeWatchers.clear();
    this.fallbackWatchers.clear();
    this.watcherHealth.clear();

    this.emit('all-watchers-closed');
  }

  // Generate unique watcher ID
  private generateWatcherId(watchPath: string): string {
    const normalized = path.normalize(watchPath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const hash = require('crypto').createHash('md5').update(normalized).digest('hex').substr(0, 8);
    return `watcher_${hash}_${Date.now()}`;
  }

  // Test platform capabilities
  async testPlatformCapabilities(): Promise<PlatformTestResult> {
    const testDir = path.join(os.tmpdir(), `re-shell-watcher-test-${Date.now()}`);
    
    try {
      await fs.ensureDir(testDir);
      
      const results: PlatformTestResult = {
        platform: this.capabilities.platform,
        nativeWatching: false,
        polling: false,
        fsevents: false,
        inotify: false,
        maxWatchedFiles: this.capabilities.maxWatchedFiles,
        recommendations: []
      };

      // Test native watching
      try {
        const nativeWatcher = chokidar.watch(testDir, { usePolling: false });
        await new Promise(resolve => setTimeout(resolve, 100));
        await nativeWatcher.close();
        results.nativeWatching = true;
      } catch (error) {
        results.recommendations.push('Native file watching is not available - use polling');
      }

      // Test polling
      try {
        const pollingWatcher = chokidar.watch(testDir, { usePolling: true, interval: 100 });
        await new Promise(resolve => setTimeout(resolve, 100));
        await pollingWatcher.close();
        results.polling = true;
      } catch (error) {
        results.recommendations.push('Polling is not available - this is unusual');
      }

      // Platform-specific tests
      if (this.capabilities.platform === 'darwin') {
        results.fsevents = results.nativeWatching; // FSEvents is the native method on macOS
      }

      if (this.capabilities.platform === 'linux') {
        results.inotify = results.nativeWatching; // inotify is the native method on Linux
      }

      // Generate recommendations
      if (!results.nativeWatching && results.polling) {
        results.recommendations.push('Use polling-based file watching for reliability');
      }

      if (this.capabilities.maxWatchedFiles < 8192) {
        results.recommendations.push('Consider increasing system file watch limits for large projects');
      }

      return results;

    } finally {
      await fs.remove(testDir);
    }
  }
}

// Watcher health status interface
export interface WatcherHealthStatus {
  isHealthy: boolean;
  lastCheck: number;
  failureCount: number;
  fallbackReady: boolean;
  lastError?: any;
  fallbackOptions?: {
    watchPath: string;
    options: any;
  };
}

// Platform test result interface
export interface PlatformTestResult {
  platform: NodeJS.Platform;
  nativeWatching: boolean;
  polling: boolean;
  fsevents: boolean;
  inotify: boolean;
  maxWatchedFiles: number;
  recommendations: string[];
}

// Utility functions
export function createPlatformWatcher(options?: Partial<WatcherFallbackOptions>): PlatformWatcher {
  return new PlatformWatcher(options);
}

export async function testPlatformWatching(): Promise<PlatformTestResult> {
  const watcher = new PlatformWatcher();
  return await watcher.testPlatformCapabilities();
}

export function getPlatformCapabilities(): PlatformCapabilities {
  const watcher = new PlatformWatcher();
  return watcher.getPlatformCapabilities();
}