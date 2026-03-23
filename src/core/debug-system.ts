import * as fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';
import chalk from 'chalk';

export interface DebugTrace {
  id: string;
  timestamp: Date;
  level: TraceLevel;
  category: string;
  operation: string;
  duration?: number;
  data?: any;
  error?: Error;
  stack?: string;
  metadata: {
    pid: number;
    memory: NodeJS.MemoryUsage;
    thread: string;
    caller?: string;
  };
}

export interface DebugSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  command: string;
  args: string[];
  options: Record<string, any>;
  traces: DebugTrace[];
  performance: {
    totalDuration?: number;
    operations: Map<string, OperationStats>;
  };
}

export interface OperationStats {
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  errors: number;
}

export enum TraceLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4
}

export interface DebugOptions {
  enabled: boolean;
  level: TraceLevel;
  outputFile?: string;
  includeStack: boolean;
  includeMemory: boolean;
  includePerformance: boolean;
  maxTraces: number;
  maxSessions: number;
  categories: string[];
  excludeCategories: string[];
  realtime: boolean;
  format: 'text' | 'json' | 'structured';
}

export class DebugSystem extends EventEmitter {
  private options: DebugOptions;
  private currentSession?: DebugSession;
  private sessions: DebugSession[] = [];
  private activeOperations: Map<string, { start: number; trace: DebugTrace }> = new Map();
  private traceCounter = 0;
  private sessionCounter = 0;
  private outputStream?: fs.WriteStream;

  constructor(options: Partial<DebugOptions> = {}) {
    super();
    
    this.options = {
      enabled: false,
      level: TraceLevel.DEBUG,
      includeStack: false,
      includeMemory: true,
      includePerformance: true,
      maxTraces: 10000,
      maxSessions: 100,
      categories: [],
      excludeCategories: [],
      realtime: false,
      format: 'structured',
      ...options
    };

    if (this.options.outputFile) {
      this.initializeOutputStream();
    }

    if (this.options.realtime) {
      this.setupRealtimeOutput();
    }
  }

  private initializeOutputStream(): void {
    if (!this.options.outputFile) return;

    try {
      const dir = path.dirname(this.options.outputFile);
      fs.ensureDirSync(dir);
      
      this.outputStream = fs.createWriteStream(this.options.outputFile, { flags: 'a' });
      
      this.outputStream.on('error', (error) => {
        console.error('Debug output stream error:', error);
      });
    } catch (error) {
      console.error('Failed to initialize debug output stream:', error);
    }
  }

  private setupRealtimeOutput(): void {
    this.on('trace', (trace: DebugTrace) => {
      if (this.shouldOutputTrace(trace)) {
        this.outputTrace(trace);
      }
    });
  }

  private shouldOutputTrace(trace: DebugTrace): boolean {
    if (!this.options.enabled) return false;
    if (trace.level < this.options.level) return false;
    
    if (this.options.categories.length > 0 && 
        !this.options.categories.includes(trace.category)) {
      return false;
    }
    
    if (this.options.excludeCategories.includes(trace.category)) {
      return false;
    }
    
    return true;
  }

  private outputTrace(trace: DebugTrace): void {
    const output = this.formatTrace(trace);
    
    if (this.outputStream) {
      this.outputStream.write(output + '\n');
    } else if (this.options.realtime) {
      console.log(output);
    }
  }

  private formatTrace(trace: DebugTrace): string {
    switch (this.options.format) {
      case 'json':
        return JSON.stringify(trace);
      
      case 'text':
        return this.formatTraceAsText(trace);
      
      case 'structured':
      default:
        return this.formatTraceStructured(trace);
    }
  }

  private formatTraceAsText(trace: DebugTrace): string {
    const timestamp = trace.timestamp.toISOString();
    const level = TraceLevel[trace.level].padEnd(5);
    const duration = trace.duration ? ` (${trace.duration}ms)` : '';
    const memory = this.options.includeMemory ? 
      ` [${Math.round(trace.metadata.memory.heapUsed / 1024 / 1024)}MB]` : '';
    
    return `${timestamp} ${level} ${trace.category}:${trace.operation}${duration}${memory}`;
  }

  private formatTraceStructured(trace: DebugTrace): string {
    const parts = [
      chalk.gray(trace.timestamp.toLocaleTimeString()),
      this.getLevelColor(trace.level)(TraceLevel[trace.level].padEnd(5)),
      chalk.cyan(`${trace.category}:`),
      chalk.white(trace.operation)
    ];

    if (trace.duration !== undefined) {
      const color = trace.duration > 1000 ? chalk.red : 
                   trace.duration > 100 ? chalk.yellow : chalk.green;
      parts.push(color(`(${trace.duration}ms)`));
    }

    if (this.options.includeMemory) {
      const memMB = Math.round(trace.metadata.memory.heapUsed / 1024 / 1024);
      parts.push(chalk.gray(`[${memMB}MB]`));
    }

    if (trace.error) {
      parts.push(chalk.red(`ERROR: ${trace.error.message}`));
    }

    return parts.join(' ');
  }

  private getLevelColor(level: TraceLevel) {
    switch (level) {
      case TraceLevel.TRACE: return chalk.gray;
      case TraceLevel.DEBUG: return chalk.blue;
      case TraceLevel.INFO: return chalk.green;
      case TraceLevel.WARN: return chalk.yellow;
      case TraceLevel.ERROR: return chalk.red;
      default: return chalk.white;
    }
  }

  startSession(command: string, args: string[], options: Record<string, any>): string {
    const sessionId = `session_${++this.sessionCounter}_${Date.now()}`;
    
    this.currentSession = {
      id: sessionId,
      startTime: new Date(),
      command,
      args,
      options,
      traces: [],
      performance: {
        operations: new Map()
      }
    };

    this.sessions.push(this.currentSession);
    
    // Trim old sessions
    if (this.sessions.length > this.options.maxSessions) {
      this.sessions = this.sessions.slice(-this.options.maxSessions);
    }

    this.trace(TraceLevel.INFO, 'session', 'start', {
      sessionId,
      command,
      args,
      options
    });

    this.emit('session:start', this.currentSession);
    
    return sessionId;
  }

  endSession(): void {
    if (!this.currentSession) return;

    this.currentSession.endTime = new Date();
    this.currentSession.performance.totalDuration = 
      this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime();

    this.trace(TraceLevel.INFO, 'session', 'end', {
      sessionId: this.currentSession.id,
      duration: this.currentSession.performance.totalDuration,
      traceCount: this.currentSession.traces.length
    });

    this.emit('session:end', this.currentSession);
    this.currentSession = undefined;
  }

  trace(
    level: TraceLevel,
    category: string,
    operation: string,
    data?: any,
    error?: Error
  ): string {
    if (!this.options.enabled || !this.currentSession) {
      return '';
    }

    const traceId = `trace_${++this.traceCounter}`;
    const caller = this.options.includeStack ? this.getCaller() : undefined;
    
    const trace: DebugTrace = {
      id: traceId,
      timestamp: new Date(),
      level,
      category,
      operation,
      data,
      error,
      stack: this.options.includeStack && error ? error.stack : undefined,
      metadata: {
        pid: process.pid,
        memory: process.memoryUsage(),
        thread: 'main',
        caller
      }
    };

    this.currentSession.traces.push(trace);
    
    // Trim traces if needed
    if (this.currentSession.traces.length > this.options.maxTraces) {
      this.currentSession.traces = this.currentSession.traces.slice(-this.options.maxTraces);
    }

    this.emit('trace', trace);
    
    return traceId;
  }

  startOperation(category: string, operation: string, data?: any): string {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const trace = this.trace(TraceLevel.DEBUG, category, `${operation}:start`, {
      operationId,
      ...data
    });

    this.activeOperations.set(operationId, {
      start: Date.now(),
      trace: (this.currentSession?.traces.find(t => t.id === trace)) as DebugTrace
    });

    return operationId;
  }

  endOperation(operationId: string, data?: any, error?: Error): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    const duration = Date.now() - operation.start;
    operation.trace.duration = duration;

    this.trace(
      error ? TraceLevel.ERROR : TraceLevel.DEBUG,
      operation.trace.category,
      `${operation.trace.operation.replace(':start', ':end')}`,
      { operationId, duration, ...data },
      error
    );

    // Update performance stats
    if (this.currentSession && this.options.includePerformance) {
      this.updatePerformanceStats(operation.trace.category, operation.trace.operation, duration, !!error);
    }

    this.activeOperations.delete(operationId);
  }

  private updatePerformanceStats(category: string, operation: string, duration: number, isError: boolean): void {
    if (!this.currentSession) return;

    const key = `${category}:${operation}`;
    const stats = this.currentSession.performance.operations.get(key) || {
      count: 0,
      totalDuration: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      errors: 0
    };

    stats.count++;
    stats.totalDuration += duration;
    stats.averageDuration = stats.totalDuration / stats.count;
    stats.minDuration = Math.min(stats.minDuration, duration);
    stats.maxDuration = Math.max(stats.maxDuration, duration);
    
    if (isError) {
      stats.errors++;
    }

    this.currentSession.performance.operations.set(key, stats);
  }

  private getCaller(): string | undefined {
    const stack = new Error().stack;
    if (!stack) return undefined;

    const lines = stack.split('\n');
    // Skip this function and the trace function
    const callerLine = lines[4];
    
    if (callerLine) {
      const match = callerLine.match(/at\s+([^(]+)\s*\(([^)]+)\)/);
      if (match) {
        return `${match[1].trim()} (${path.basename(match[2])})`;
      }
    }

    return undefined;
  }

  // Convenience methods
  traceInfo(category: string, operation: string, data?: any): string {
    return this.trace(TraceLevel.INFO, category, operation, data);
  }

  traceDebug(category: string, operation: string, data?: any): string {
    return this.trace(TraceLevel.DEBUG, category, operation, data);
  }

  traceWarn(category: string, operation: string, data?: any): string {
    return this.trace(TraceLevel.WARN, category, operation, data);
  }

  traceError(category: string, operation: string, error: Error, data?: any): string {
    return this.trace(TraceLevel.ERROR, category, operation, data, error);
  }

  // Timing helpers
  time(category: string, operation: string): () => void {
    const operationId = this.startOperation(category, operation);
    
    return (data?: any, error?: Error) => {
      this.endOperation(operationId, data, error);
    };
  }

  async timeAsync<T>(
    category: string,
    operation: string,
    fn: () => Promise<T>,
    data?: any
  ): Promise<T> {
    const operationId = this.startOperation(category, operation, data);
    
    try {
      const result = await fn();
      this.endOperation(operationId, { success: true });
      return result;
    } catch (error) {
      this.endOperation(operationId, { success: false }, error as Error);
      throw error;
    }
  }

  // Query and analysis
  getCurrentSession(): DebugSession | undefined {
    return this.currentSession;
  }

  getAllSessions(): DebugSession[] {
    return [...this.sessions];
  }

  getSession(sessionId: string): DebugSession | undefined {
    return this.sessions.find(s => s.id === sessionId);
  }

  searchTraces(query: {
    sessionId?: string;
    category?: string;
    operation?: string;
    level?: TraceLevel;
    startTime?: Date;
    endTime?: Date;
  }): DebugTrace[] {
    let sessions = this.sessions;
    
    if (query.sessionId) {
      const session = this.getSession(query.sessionId);
      sessions = session ? [session] : [];
    }

    const traces: DebugTrace[] = [];
    
    for (const session of sessions) {
      for (const trace of session.traces) {
        if (query.category && trace.category !== query.category) continue;
        if (query.operation && !trace.operation.includes(query.operation)) continue;
        if (query.level !== undefined && trace.level !== query.level) continue;
        if (query.startTime && trace.timestamp < query.startTime) continue;
        if (query.endTime && trace.timestamp > query.endTime) continue;
        
        traces.push(trace);
      }
    }

    return traces;
  }

  generateReport(sessionId?: string): string {
    const session = sessionId ? this.getSession(sessionId) : this.currentSession;
    if (!session) return 'No session found';

    const report = [];
    
    // Session info
    report.push(chalk.bold('Debug Session Report'));
    report.push(chalk.gray('='.repeat(50)));
    report.push(`Session ID: ${session.id}`);
    report.push(`Command: ${session.command} ${session.args.join(' ')}`);
    report.push(`Start Time: ${session.startTime.toISOString()}`);
    
    if (session.endTime) {
      report.push(`End Time: ${session.endTime.toISOString()}`);
      report.push(`Duration: ${session.performance.totalDuration}ms`);
    }
    
    report.push(`Traces: ${session.traces.length}`);
    report.push('');

    // Performance stats
    if (session.performance.operations.size > 0) {
      report.push(chalk.bold('Performance Statistics'));
      report.push(chalk.gray('-'.repeat(30)));
      
      for (const [operation, stats] of session.performance.operations) {
        report.push(`${operation}:`);
        report.push(`  Count: ${stats.count}`);
        report.push(`  Total: ${stats.totalDuration}ms`);
        report.push(`  Average: ${Math.round(stats.averageDuration)}ms`);
        report.push(`  Min: ${stats.minDuration}ms`);
        report.push(`  Max: ${stats.maxDuration}ms`);
        if (stats.errors > 0) {
          report.push(chalk.red(`  Errors: ${stats.errors}`));
        }
        report.push('');
      }
    }

    // Error summary
    const errors = session.traces.filter(t => t.level === TraceLevel.ERROR);
    if (errors.length > 0) {
      report.push(chalk.bold.red('Errors'));
      report.push(chalk.gray('-'.repeat(20)));
      
      for (const error of errors) {
        report.push(`${error.timestamp.toLocaleTimeString()} - ${error.category}:${error.operation}`);
        if (error.error) {
          report.push(`  ${error.error.message}`);
        }
        report.push('');
      }
    }

    return report.join('\n');
  }

  exportSession(sessionId: string, format: 'json' | 'csv' = 'json'): string {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    if (format === 'json') {
      return JSON.stringify(session, null, 2);
    }

    // CSV format
    const headers = ['timestamp', 'level', 'category', 'operation', 'duration', 'memory', 'error'];
    const rows = [headers.join(',')];

    for (const trace of session.traces) {
      const row = [
        trace.timestamp.toISOString(),
        TraceLevel[trace.level],
        trace.category,
        trace.operation,
        trace.duration || '',
        Math.round(trace.metadata.memory.heapUsed / 1024 / 1024),
        trace.error ? trace.error.message.replace(/,/g, ';') : ''
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  // Configuration
  setOptions(options: Partial<DebugOptions>): void {
    this.options = { ...this.options, ...options };
    
    if (options.outputFile && !this.outputStream) {
      this.initializeOutputStream();
    }
    
    if (options.realtime && !this.listenerCount('trace')) {
      this.setupRealtimeOutput();
    }
  }

  getOptions(): DebugOptions {
    return { ...this.options };
  }

  enable(): void {
    this.options.enabled = true;
  }

  disable(): void {
    this.options.enabled = false;
  }

  isEnabled(): boolean {
    return this.options.enabled;
  }

  close(): void {
    if (this.outputStream) {
      this.outputStream.end();
      this.outputStream = undefined;
    }
    
    this.removeAllListeners();
  }
}

// Global debug system
let globalDebugSystem: DebugSystem | null = null;

export function createDebugSystem(options?: Partial<DebugOptions>): DebugSystem {
  return new DebugSystem(options);
}

export function getGlobalDebugSystem(): DebugSystem {
  if (!globalDebugSystem) {
    const debugEnabled = process.env.DEBUG === 'true' || 
                        process.argv.includes('--debug') ||
                        process.argv.includes('--verbose');
    
    globalDebugSystem = new DebugSystem({
      enabled: debugEnabled,
      level: debugEnabled ? TraceLevel.DEBUG : TraceLevel.INFO,
      realtime: debugEnabled,
      outputFile: debugEnabled ? path.join(process.cwd(), '.re-shell', 'debug.log') : undefined
    });
  }
  return globalDebugSystem;
}

export function setGlobalDebugSystem(debug: DebugSystem): void {
  if (globalDebugSystem) {
    globalDebugSystem.close();
  }
  globalDebugSystem = debug;
}