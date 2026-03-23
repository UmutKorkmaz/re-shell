import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export interface ErrorContext {
  id: string;
  timestamp: Date;
  command: string;
  args: Record<string, any>;
  options: Record<string, any>;
  error: Error;
  stack: string;
  environment: EnvironmentInfo;
  context: Record<string, any>;
  breadcrumbs: Breadcrumb[];
  tags: Record<string, string>;
  level: ErrorLevel;
}

export interface EnvironmentInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  cliVersion: string;
  cwd: string;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  timing: {
    uptime: number;
    processUptime: number;
  };
}

export interface Breadcrumb {
  timestamp: Date;
  message: string;
  category: string;
  level: BreadcrumbLevel;
  data?: Record<string, any>;
}

export enum ErrorLevel {
  DEBUG = 0,
  INFO = 1,
  WARNING = 2,
  ERROR = 3,
  FATAL = 4
}

export enum BreadcrumbLevel {
  DEBUG = 0,
  INFO = 1,
  WARNING = 2,
  ERROR = 3
}

export interface ErrorContextOptions {
  maxBreadcrumbs?: number;
  maxContextSize?: number;
  enableStackTrace?: boolean;
  enableEnvironment?: boolean;
  enableMemoryInfo?: boolean;
  enableFileContext?: boolean;
  storageDir?: string;
  autoCapture?: boolean;
}

export class ErrorContextManager extends EventEmitter {
  private breadcrumbs: Breadcrumb[] = [];
  private context: Record<string, any> = {};
  private tags: Record<string, string> = {};
  private maxBreadcrumbs: number;
  private maxContextSize: number;
  private enableStackTrace: boolean;
  private enableEnvironment: boolean;
  private enableMemoryInfo: boolean;
  private enableFileContext: boolean;
  private storageDir: string;
  private autoCapture: boolean;

  constructor(options: ErrorContextOptions = {}) {
    super();
    
    this.maxBreadcrumbs = options.maxBreadcrumbs ?? 100;
    this.maxContextSize = options.maxContextSize ?? 10000;
    this.enableStackTrace = options.enableStackTrace ?? true;
    this.enableEnvironment = options.enableEnvironment ?? true;
    this.enableMemoryInfo = options.enableMemoryInfo ?? true;
    this.enableFileContext = options.enableFileContext ?? false;
    this.storageDir = options.storageDir ?? path.join(process.cwd(), '.re-shell', 'errors');
    this.autoCapture = options.autoCapture ?? true;

    if (this.autoCapture) {
      this.setupAutoCapture();
    }
  }

  private setupAutoCapture(): void {
    // Capture unhandled exceptions
    process.on('uncaughtException', (error) => {
      this.captureException(error, {
        level: ErrorLevel.FATAL,
        command: 'unknown',
        args: {},
        options: {}
      });
    });

    // Capture unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.captureException(error, {
        level: ErrorLevel.ERROR,
        command: 'unknown',
        args: {},
        options: {},
        context: { promise: promise.toString() }
      });
    });
  }

  captureException(
    error: Error,
    context: {
      command: string;
      args: Record<string, any>;
      options: Record<string, any>;
      level?: ErrorLevel;
      context?: Record<string, any>;
      tags?: Record<string, string>;
    }
  ): string {
    const errorId = this.generateErrorId();
    
    const errorContext: ErrorContext = {
      id: errorId,
      timestamp: new Date(),
      command: context.command,
      args: context.args,
      options: context.options,
      error,
      stack: this.enableStackTrace ? this.captureStackTrace(error) : '',
      environment: this.enableEnvironment ? this.captureEnvironment() : {} as EnvironmentInfo,
      context: {
        ...this.context,
        ...context.context
      },
      breadcrumbs: [...this.breadcrumbs],
      tags: {
        ...this.tags,
        ...context.tags
      },
      level: context.level ?? ErrorLevel.ERROR
    };

    // Store error context
    this.storeErrorContext(errorContext);

    // Emit event
    this.emit('error:captured', errorContext);

    return errorId;
  }

  private generateErrorId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  private captureStackTrace(error: Error): string {
    if (error.stack) {
      return error.stack;
    }

    // Capture current stack if error doesn't have one
    const stackTrace = new Error().stack;
    return stackTrace?.split('\n').slice(2).join('\n') || '';
  }

  private captureEnvironment(): EnvironmentInfo {
    const memUsage = process.memoryUsage();
    
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cliVersion: this.getCliVersion(),
      cwd: process.cwd(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      },
      timing: {
        uptime: os.uptime(),
        processUptime: process.uptime()
      }
    };
  }

  private getCliVersion(): string {
    try {
      const packagePath = path.join(__dirname, '..', '..', 'package.json');
      const pkg = fs.readJsonSync(packagePath);
      return pkg.version;
    } catch {
      return 'unknown';
    }
  }

  private storeErrorContext(errorContext: ErrorContext): void {
    try {
      // Ensure directory exists
      fs.ensureDirSync(this.storageDir);

      // Write error context to file
      const filename = `error-${errorContext.id}.json`;
      const filepath = path.join(this.storageDir, filename);
      
      const data = {
        ...errorContext,
        error: {
          name: errorContext.error.name,
          message: errorContext.error.message,
          stack: errorContext.error.stack
        }
      };

      fs.writeJsonSync(filepath, data, { spaces: 2 });

      // Clean up old error files (keep last 50)
      this.cleanupOldErrors();

    } catch (storeError) {
      // Don't throw errors from error storage
      console.error('Failed to store error context:', storeError);
    }
  }

  private cleanupOldErrors(): void {
    try {
      const files = fs.readdirSync(this.storageDir)
        .filter(f => f.startsWith('error-') && f.endsWith('.json'))
        .sort();

      if (files.length > 50) {
        const toDelete = files.slice(0, files.length - 50);
        for (const file of toDelete) {
          fs.unlinkSync(path.join(this.storageDir, file));
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    const fullBreadcrumb: Breadcrumb = {
      ...breadcrumb,
      timestamp: new Date()
    };

    this.breadcrumbs.push(fullBreadcrumb);

    // Trim breadcrumbs if needed
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }

    this.emit('breadcrumb:added', fullBreadcrumb);
  }

  setContext(key: string, value: any): void {
    this.context[key] = value;

    // Check context size
    const contextSize = JSON.stringify(this.context).length;
    if (contextSize > this.maxContextSize) {
      // Remove oldest entries
      const keys = Object.keys(this.context);
      const toRemove = Math.ceil(keys.length * 0.1); // Remove 10%
      for (let i = 0; i < toRemove; i++) {
        delete this.context[keys[i]];
      }
    }

    this.emit('context:set', { key, value });
  }

  removeContext(key: string): void {
    delete this.context[key];
    this.emit('context:removed', { key });
  }

  getContext(): Record<string, any> {
    return { ...this.context };
  }

  setTag(key: string, value: string): void {
    this.tags[key] = value;
    this.emit('tag:set', { key, value });
  }

  removeTag(key: string): void {
    delete this.tags[key];
    this.emit('tag:removed', { key });
  }

  getTags(): Record<string, string> {
    return { ...this.tags };
  }

  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
    this.emit('breadcrumbs:cleared');
  }

  clearContext(): void {
    this.context = {};
    this.emit('context:cleared');
  }

  clearTags(): void {
    this.tags = {};
    this.emit('tags:cleared');
  }

  clear(): void {
    this.clearBreadcrumbs();
    this.clearContext();
    this.clearTags();
    this.emit('cleared');
  }

  getErrorContext(errorId: string): ErrorContext | null {
    try {
      const filepath = path.join(this.storageDir, `error-${errorId}.json`);
      if (fs.existsSync(filepath)) {
        const data = fs.readJsonSync(filepath);
        return data as ErrorContext;
      }
    } catch {
      // Ignore read errors
    }
    return null;
  }

  getAllErrorContexts(): ErrorContext[] {
    try {
      const files = fs.readdirSync(this.storageDir)
        .filter(f => f.startsWith('error-') && f.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first

      const contexts: ErrorContext[] = [];
      for (const file of files) {
        try {
          const filepath = path.join(this.storageDir, file);
          const data = fs.readJsonSync(filepath);
          contexts.push(data as ErrorContext);
        } catch {
          // Skip corrupted files
        }
      }

      return contexts;
    } catch {
      return [];
    }
  }

  deleteErrorContext(errorId: string): boolean {
    try {
      const filepath = path.join(this.storageDir, `error-${errorId}.json`);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        this.emit('error:deleted', { errorId });
        return true;
      }
    } catch {
      // Ignore delete errors
    }
    return false;
  }

  getRecentErrors(count = 10): ErrorContext[] {
    return this.getAllErrorContexts().slice(0, count);
  }

  searchErrors(query: {
    command?: string;
    level?: ErrorLevel;
    tag?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): ErrorContext[] {
    const allErrors = this.getAllErrorContexts();
    
    return allErrors.filter(error => {
      if (query.command && !error.command.includes(query.command)) {
        return false;
      }
      
      if (query.level !== undefined && error.level !== query.level) {
        return false;
      }
      
      if (query.tag && !Object.keys(error.tags).includes(query.tag)) {
        return false;
      }
      
      if (query.dateFrom && error.timestamp < query.dateFrom) {
        return false;
      }
      
      if (query.dateTo && error.timestamp > query.dateTo) {
        return false;
      }
      
      return true;
    });
  }

  generateReport(): {
    summary: {
      totalErrors: number;
      errorsByLevel: Record<string, number>;
      errorsByCommand: Record<string, number>;
      recentErrors: number;
    };
    trends: {
      last24Hours: number;
      last7Days: number;
      last30Days: number;
    };
  } {
    const allErrors = this.getAllErrorContexts();
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;

    const errorsByLevel: Record<string, number> = {};
    const errorsByCommand: Record<string, number> = {};
    
    let last24Hours = 0;
    let last7Days = 0;
    let last30Days = 0;

    for (const error of allErrors) {
      // Count by level
      const level = ErrorLevel[error.level];
      errorsByLevel[level] = (errorsByLevel[level] || 0) + 1;
      
      // Count by command
      errorsByCommand[error.command] = (errorsByCommand[error.command] || 0) + 1;
      
      // Count by time periods
      const errorTime = new Date(error.timestamp).getTime();
      const timeDiff = now.getTime() - errorTime;
      
      if (timeDiff <= day) last24Hours++;
      if (timeDiff <= 7 * day) last7Days++;
      if (timeDiff <= 30 * day) last30Days++;
    }

    return {
      summary: {
        totalErrors: allErrors.length,
        errorsByLevel,
        errorsByCommand,
        recentErrors: last24Hours
      },
      trends: {
        last24Hours,
        last7Days,
        last30Days
      }
    };
  }
}

// Global error context manager
let globalErrorContext: ErrorContextManager | null = null;

export function createErrorContextManager(options?: ErrorContextOptions): ErrorContextManager {
  return new ErrorContextManager(options);
}

export function getGlobalErrorContext(): ErrorContextManager {
  if (!globalErrorContext) {
    globalErrorContext = new ErrorContextManager();
  }
  return globalErrorContext;
}

export function setGlobalErrorContext(manager: ErrorContextManager): void {
  globalErrorContext = manager;
}