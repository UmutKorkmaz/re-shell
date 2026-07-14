import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { ValidationError } from './error-handler';

/**
 * Describes the file watching capabilities, limits, and recommended methods
 * for the current operating system/platform.
 */
export interface PlatformCapabilities {
  /** The Node.js platform identifier (e.g. 'darwin', 'linux', 'win32'). */
  platform: NodeJS.Platform;
  /** The CPU architecture string (e.g. 'x64', 'arm64'). */
  architecture: string;
  /** Whether the platform supports native (non-polling) file watching. */
  supportsNativeWatching: boolean;
  /** Whether the platform supports polling-based file watching. */
  supportsPolling: boolean;
  /** Whether the platform supports macOS FSEvents. */
  supportsFSEvents: boolean;
  /** Whether the platform supports Linux inotify. */
  supportsInotify: boolean;
  /** The maximum number of files the platform can reliably watch. */
  maxWatchedFiles: number;
  /** The recommended file watching method for this platform. */
  recommendedWatchMethod: WatchMethod;
  /** Ordered list of fallback watching methods if the primary method fails. */
  fallbackMethods: WatchMethod[];
  /** Human-readable list of known platform limitations. */
  limitations: string[];
}

/**
 * Identifies a file watching strategy.
 * - `native`: OS native (non-polling) watcher.
 * - `polling`: Polling-based watcher.
 * - `fsevents`: macOS FSEvents watcher.
 * - `inotify`: Linux inotify watcher.
 * - `hybrid`: Combination of multiple watching strategies.
 */
export type WatchMethod = 'native' | 'polling' | 'fsevents' | 'inotify' | 'hybrid';

/**
 * Configuration options that control watcher fallback behavior, retry policy,
 * health checking, and platform-specific optimizations.
 */
export interface WatcherFallbackOptions {
  /** The primary watching method to attempt first. */
  primaryMethod: WatchMethod;
  /** Ordered list of fallback methods to try if the primary method fails. */
  fallbackMethods: WatchMethod[];
  /** Delay (in milliseconds) before activating a fallback watcher. */
  fallbackDelay: number;
  /** Maximum number of retries before triggering a fallback. */
  maxRetries: number;
  /** Interval (in milliseconds) between periodic health checks. */
  healthCheckInterval: number;
  /** Whether to emit log output during fallback operations. */
  enableFallbackLogging: boolean;
  /** Whether to enable platform-specific optimizations. */
  platformOptimizations: boolean;
  /** Whether polling intervals should adapt based on directory complexity. */
  adaptivePolling: boolean;
}

/**
 * Options accepted when creating a platform-aware file watcher.
 */
export interface PlatformWatchOptions {
  /** Force the use of polling instead of native watching. */
  usePolling?: boolean;
  /** Polling interval (in milliseconds) for regular files. */
  interval?: number;
  /** Polling interval (in milliseconds) for binary files. */
  binaryInterval?: number;
  /** Whether to use the OS native watcher when available. */
  useNativeWatcher?: boolean;
  /** Whether to enable fallback watchers when the primary fails. */
  enableFallbacks?: boolean;
  /** Partial override of the default fallback options. */
  fallbackOptions?: Partial<WatcherFallbackOptions>;
  /** Platform-specific overrides keyed by platform name. */
  platformSpecific?: {
    /** Overrides applied only on macOS (darwin). */
    darwin?: any;
    /** Overrides applied only on Linux. */
    linux?: any;
    /** Overrides applied only on Windows (win32). */
    win32?: any;
    /** Index signature allowing additional platform overrides. */
    [key: string]: any;
  };
}

/**
 * Cross-platform file watcher with intelligent fallbacks.
 *
 * Detects platform-specific capabilities, creates optimized watchers, monitors
 * their health, and transparently falls back to alternative watching methods
 * when the primary method fails. Extends `EventEmitter` to emit lifecycle and
 * health events such as `watcher-created`, `watcher-error`, `fallback-activated`,
 * `watcher-unhealthy`, and `health-check-completed`.
 */
export class PlatformWatcher extends EventEmitter {
  private capabilities: PlatformCapabilities;
  private activeWatchers: Map<string, chokidar.FSWatcher> = new Map();
  private fallbackWatchers: Map<string, chokidar.FSWatcher> = new Map();
  private watcherHealth: Map<string, WatcherHealthStatus> = new Map();
  private fallbackOptions: WatcherFallbackOptions;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isActive = false;

  /**
   * Creates a new PlatformWatcher instance.
   *
   * @param fallbackOptions Optional partial override of the default fallback options.
   *   Missing values are filled in from platform-detected defaults.
   */
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

  /**
   * Creates a platform-optimized file watcher for the given path.
   *
   * Applies platform-specific optimizations, sets up health monitoring, and
   * optionally prepares a fallback watcher. If the primary watcher cannot be
   * created and fallbacks are enabled, a fallback method is attempted.
   *
   * @param watchPath Absolute or relative path to watch.
   * @param options Optional platform watch options controlling polling, fallbacks,
   *   and platform-specific overrides.
   * @returns A promise resolving to the created chokidar `FSWatcher`.
   * @throws {ValidationError} If the watcher cannot be created and no fallback succeeds.
   */
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

  /**
   * Returns a copy of the detected platform capabilities.
   *
   * @returns A shallow copy of the current `PlatformCapabilities`.
   */
  getPlatformCapabilities(): PlatformCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Returns the health status of one or all watchers.
   *
   * @param watcherId Optional watcher identifier. If omitted, all watcher
   *   health statuses are returned.
   * @returns The health status for the given watcher (or `null` if not found),
   *   or a `Map` of all watcher health statuses when no identifier is supplied.
   */
  getWatcherHealth(watcherId?: string): Map<string, WatcherHealthStatus> | WatcherHealthStatus | null {
    if (watcherId) {
      return this.watcherHealth.get(watcherId) || null;
    }
    return new Map(this.watcherHealth);
  }

  /**
   * Returns the number of currently active watchers.
   *
   * @returns The count of active watchers.
   */
  getActiveWatchersCount(): number {
    return this.activeWatchers.size;
  }

  /**
   * Closes all active and fallback watchers and clears internal state.
   *
   * Stops periodic health checks, closes every watcher (suppressing individual
   * close errors), clears internal maps, and emits the `all-watchers-closed` event.
   *
   * @returns A promise that resolves once all watchers have been closed.
   */
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

  /**
   * Tests the file watching capabilities of the current platform.
   *
   * Creates a temporary directory and attempts to instantiate native and
   * polling-based watchers against it, recording which methods succeed and
   * generating recommendations. The temporary directory is always cleaned up.
   *
   * @returns A promise resolving to a `PlatformTestResult` describing
   *   the available watching mechanisms and any recommendations.
   */
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

/**
 * Represents the runtime health status of a single file watcher.
 */
export interface WatcherHealthStatus {
  /** Whether the watcher is currently considered healthy. */
  isHealthy: boolean;
  /** Timestamp (milliseconds since epoch) of the most recent health check. */
  lastCheck: number;
  /** Number of consecutive failures observed. */
  failureCount: number;
  /** Whether a fallback watcher has been prepared and is ready to activate. */
  fallbackReady: boolean;
  /** The most recent error encountered, if any. */
  lastError?: any;
  /** Configuration for the prepared fallback watcher, if available. */
  fallbackOptions?: {
    /** Path the fallback watcher should observe. */
    watchPath: string;
    /** Options to pass when constructing the fallback watcher. */
    options: any;
  };
}

/**
 * Result of probing the current platform's file watching capabilities.
 */
export interface PlatformTestResult {
  /** The Node.js platform identifier that was tested. */
  platform: NodeJS.Platform;
  /** Whether native (non-polling) file watching is available. */
  nativeWatching: boolean;
  /** Whether polling-based file watching is available. */
  polling: boolean;
  /** Whether macOS FSEvents is available. */
  fsevents: boolean;
  /** Whether Linux inotify is available. */
  inotify: boolean;
  /** The maximum number of files the platform can reliably watch. */
  maxWatchedFiles: number;
  /** Human-readable recommendations derived from the test results. */
  recommendations: string[];
}

/**
 * Factory that creates a new `PlatformWatcher` instance.
 *
 * @param options Optional partial override of the default fallback options.
 * @returns A new `PlatformWatcher`.
 */
export function createPlatformWatcher(options?: Partial<WatcherFallbackOptions>): PlatformWatcher {
  return new PlatformWatcher(options);
}

/**
 * Convenience helper that tests the current platform's file watching capabilities.
 *
 * @returns A promise resolving to a `PlatformTestResult`.
 */
export async function testPlatformWatching(): Promise<PlatformTestResult> {
  const watcher = new PlatformWatcher();
  return await watcher.testPlatformCapabilities();
}

/**
 * Convenience helper that returns the detected platform capabilities.
 *
 * @returns The `PlatformCapabilities` for the current platform.
 */
export function getPlatformCapabilities(): PlatformCapabilities {
  const watcher = new PlatformWatcher();
  return watcher.getPlatformCapabilities();
}