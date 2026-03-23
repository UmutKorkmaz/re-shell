import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: Date;
  sessionId: string;
  userId?: string;
  version: string;
  platform: string;
  nodeVersion: string;
}

export interface AnalyticsMetric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface AnalyticsTiming {
  label: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

export interface AnalyticsOptions {
  enabled?: boolean;
  debug?: boolean;
  batchSize?: number;
  flushInterval?: number;
  endpoint?: string;
  storageDir?: string;
  anonymize?: boolean;
  customProperties?: Record<string, any>;
}

export class Analytics extends EventEmitter {
  private enabled: boolean;
  private debug: boolean;
  private batchSize: number;
  private flushInterval: number;
  private endpoint?: string;
  private storageDir: string;
  private anonymize: boolean;
  private customProperties: Record<string, any>;
  
  private sessionId: string;
  private userId?: string;
  private events: AnalyticsEvent[] = [];
  private metrics: AnalyticsMetric[] = [];
  private timings: Map<string, AnalyticsTiming> = new Map();
  private flushTimer?: NodeJS.Timeout;

  constructor(options: AnalyticsOptions = {}) {
    super();
    
    this.enabled = options.enabled ?? this.isAnalyticsEnabled();
    this.debug = options.debug ?? false;
    this.batchSize = options.batchSize ?? 100;
    this.flushInterval = options.flushInterval ?? 30000; // 30 seconds
    this.endpoint = options.endpoint;
    this.storageDir = options.storageDir ?? path.join(process.cwd(), '.re-shell', 'analytics');
    this.anonymize = options.anonymize ?? true;
    this.customProperties = options.customProperties ?? {};
    
    this.sessionId = this.generateSessionId();
    this.userId = this.generateUserId();
    
    if (this.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    // Ensure storage directory exists
    fs.ensureDirSync(this.storageDir);
    
    // Load any pending events
    this.loadPendingEvents();
    
    // Start flush timer
    this.startFlushTimer();
    
    // Handle process exit
    process.on('exit', () => this.flush());
    process.on('SIGINT', () => this.flush());
    process.on('SIGTERM', () => this.flush());
  }

  private isAnalyticsEnabled(): boolean {
    // Check environment variables
    if (process.env.RESHELL_ANALYTICS === 'false') return false;
    if (process.env.CI === 'true') return false;
    if (process.env.NODE_ENV === 'test') return false;
    
    // Check user preference
    const configPath = path.join(process.cwd(), '.re-shell', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = fs.readJsonSync(configPath);
        return config.analytics?.enabled !== false;
      } catch {
        // Ignore errors
      }
    }
    
    return true;
  }

  private generateSessionId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateUserId(): string | undefined {
    if (this.anonymize) {
      // Generate anonymous user ID based on machine ID
      const machineId = this.getMachineId();
      return crypto.createHash('sha256').update(machineId).digest('hex');
    }
    
    // Use actual user ID if available
    const configPath = path.join(process.cwd(), '.re-shell', 'user.json');
    if (fs.existsSync(configPath)) {
      try {
        const user = fs.readJsonSync(configPath);
        return user.id;
      } catch {
        // Ignore errors
      }
    }
    
    return undefined;
  }

  private getMachineId(): string {
    // Simple machine ID based on hostname and platform
    return crypto.createHash('md5')
      .update(os.hostname() + os.platform() + os.arch())
      .digest('hex');
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.events.length > 0 || this.metrics.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  track(event: string, properties?: Record<string, any>): void {
    if (!this.enabled) return;
    
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...this.customProperties,
        ...properties
      },
      timestamp: new Date(),
      sessionId: this.sessionId,
      userId: this.userId,
      version: this.getVersion(),
      platform: process.platform,
      nodeVersion: process.version
    };
    
    this.events.push(analyticsEvent);
    this.emit('event', analyticsEvent);
    
    if (this.debug) {
      console.log('[Analytics] Event:', event, properties);
    }
    
    // Auto-flush if batch size reached
    if (this.events.length >= this.batchSize) {
      this.flush();
    }
  }

  timeStart(label: string): void {
    if (!this.enabled) return;
    
    this.timings.set(label, {
      label,
      startTime: Date.now()
    });
    
    if (this.debug) {
      console.log('[Analytics] Timer started:', label);
    }
  }

  timeEnd(label: string): void {
    if (!this.enabled) return;
    
    const timing = this.timings.get(label);
    if (!timing) {
      console.warn(`[Analytics] Timer ${label} not found`);
      return;
    }
    
    timing.endTime = Date.now();
    timing.duration = timing.endTime - timing.startTime;
    
    // Track as event
    this.track('timing', {
      label,
      duration: timing.duration,
      unit: 'ms'
    });
    
    // Clean up
    this.timings.delete(label);
    
    if (this.debug) {
      console.log('[Analytics] Timer ended:', label, timing.duration + 'ms');
    }
  }

  increment(metric: string, value = 1, tags?: Record<string, string>): void {
    if (!this.enabled) return;
    
    const analyticsMetric: AnalyticsMetric = {
      name: metric,
      value,
      timestamp: new Date(),
      tags
    };
    
    this.metrics.push(analyticsMetric);
    this.emit('metric', analyticsMetric);
    
    if (this.debug) {
      console.log('[Analytics] Metric:', metric, value, tags);
    }
  }

  flush(): void {
    if (!this.enabled) return;
    if (this.events.length === 0 && this.metrics.length === 0) return;
    
    const data = {
      events: [...this.events],
      metrics: [...this.metrics],
      sessionId: this.sessionId,
      timestamp: new Date()
    };
    
    // Clear arrays
    this.events = [];
    this.metrics = [];
    
    // Save to disk
    this.saveToDisk(data);
    
    // Send to endpoint if configured
    if (this.endpoint) {
      this.sendToEndpoint(data);
    }
    
    this.emit('flush', data);
    
    if (this.debug) {
      console.log('[Analytics] Flushed:', data.events.length, 'events,', data.metrics.length, 'metrics');
    }
  }

  private saveToDisk(data: any): void {
    try {
      const filename = `analytics-${Date.now()}.json`;
      const filepath = path.join(this.storageDir, filename);
      fs.writeJsonSync(filepath, data, { spaces: 2 });
      
      // Clean up old files (keep last 100)
      this.cleanupOldFiles();
    } catch (error) {
      if (this.debug) {
        console.error('[Analytics] Failed to save to disk:', error);
      }
    }
  }

  private cleanupOldFiles(): void {
    try {
      const files = fs.readdirSync(this.storageDir)
        .filter(f => f.startsWith('analytics-') && f.endsWith('.json'))
        .sort();
      
      if (files.length > 100) {
        const toDelete = files.slice(0, files.length - 100);
        for (const file of toDelete) {
          fs.unlinkSync(path.join(this.storageDir, file));
        }
      }
    } catch (error) {
      if (this.debug) {
        console.error('[Analytics] Failed to cleanup old files:', error);
      }
    }
  }

  private sendToEndpoint(data: any): void {
    // TODO: Implement HTTP POST to analytics endpoint
    // This would typically send to a service like Segment, Mixpanel, etc.
    if (this.debug) {
      console.log('[Analytics] Would send to endpoint:', this.endpoint);
    }
  }

  private loadPendingEvents(): void {
    try {
      const files = fs.readdirSync(this.storageDir)
        .filter(f => f.startsWith('analytics-') && f.endsWith('.json'));
      
      // TODO: Process pending files and send to endpoint
      if (this.debug && files.length > 0) {
        console.log('[Analytics] Found', files.length, 'pending analytics files');
      }
    } catch (error) {
      if (this.debug) {
        console.error('[Analytics] Failed to load pending events:', error);
      }
    }
  }

  private getVersion(): string {
    try {
      const packagePath = path.join(__dirname, '..', '..', 'package.json');
      const pkg = fs.readJsonSync(packagePath);
      return pkg.version;
    } catch {
      return 'unknown';
    }
  }

  disable(): void {
    this.enabled = false;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  enable(): void {
    this.enabled = true;
    if (!this.flushTimer) {
      this.startFlushTimer();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  setCustomProperties(properties: Record<string, any>): void {
    this.customProperties = { ...this.customProperties, ...properties };
  }

  getSessionId(): string {
    return this.sessionId;
  }

  public getUserId(): string | undefined {
    return this.userId;
  }
}

// Global analytics instance
let globalAnalytics: Analytics | null = null;

export function createAnalytics(options?: AnalyticsOptions): Analytics {
  return new Analytics(options);
}

export function getGlobalAnalytics(): Analytics {
  if (!globalAnalytics) {
    globalAnalytics = new Analytics();
  }
  return globalAnalytics;
}

export function setGlobalAnalytics(analytics: Analytics): void {
  if (globalAnalytics) {
    globalAnalytics.flush();
    globalAnalytics.disable();
  }
  globalAnalytics = analytics;
}