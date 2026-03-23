import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { format } from 'util';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SUCCESS = 4,
  SILENT = 99
}

export interface LogEntry {
  level: LogLevel;
  timestamp: Date;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

export interface LoggerOptions {
  level?: LogLevel;
  file?: string;
  maxFileSize?: number;
  maxFiles?: number;
  json?: boolean;
  timestamp?: boolean;
  color?: boolean;
  context?: Record<string, any>;
}

export class Logger {
  private level: LogLevel;
  private file?: string;
  private maxFileSize: number;
  private maxFiles: number;
  private json: boolean;
  private timestamp: boolean;
  private color: boolean;
  private context: Record<string, any>;
  private fileStream?: fs.WriteStream;
  private currentFileSize = 0;
  private rotationIndex = 0;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.file = options.file;
    this.maxFileSize = options.maxFileSize ?? 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles ?? 5;
    this.json = options.json ?? false;
    this.timestamp = options.timestamp ?? true;
    this.color = options.color ?? process.stdout.isTTY;
    this.context = options.context ?? {};

    if (this.file) {
      this.initializeFile();
    }
  }

  private initializeFile(): void {
    if (!this.file) return;

    const dir = path.dirname(this.file);
    fs.ensureDirSync(dir);

    // Check if file exists and get size
    if (fs.existsSync(this.file)) {
      const stats = fs.statSync(this.file);
      this.currentFileSize = stats.size;
    }

    // Create write stream
    this.fileStream = fs.createWriteStream(this.file, { flags: 'a' });
  }

  private rotateFile(): void {
    if (!this.file || !this.fileStream) return;

    // Close current stream
    this.fileStream.end();

    // Rotate files
    for (let i = this.maxFiles - 1; i > 0; i--) {
      const oldFile = `${this.file}.${i}`;
      const newFile = `${this.file}.${i + 1}`;
      
      if (fs.existsSync(oldFile)) {
        if (i === this.maxFiles - 1) {
          fs.unlinkSync(oldFile); // Delete oldest
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    // Rename current file
    fs.renameSync(this.file, `${this.file}.1`);

    // Reset and create new file
    this.currentFileSize = 0;
    this.fileStream = fs.createWriteStream(this.file, { flags: 'a' });
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(entry: LogEntry): string {
    if (this.json) {
      return JSON.stringify({
        level: LogLevel[entry.level],
        timestamp: entry.timestamp.toISOString(),
        message: entry.message,
        ...this.context,
        ...entry.context,
        ...(entry.error && {
          error: {
            name: entry.error.name,
            message: entry.error.message,
            stack: entry.error.stack
          }
        })
      });
    }

    let message = '';

    // Add timestamp
    if (this.timestamp) {
      const time = entry.timestamp.toLocaleTimeString();
      message += this.color ? chalk.gray(`[${time}]`) : `[${time}]`;
      message += ' ';
    }

    // Add level
    const levelStr = this.getLevelString(entry.level);
    message += levelStr + ' ';

    // Add message
    message += entry.message;

    // Add context
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = JSON.stringify(entry.context, null, 2);
      message += '\n' + (this.color ? chalk.gray(contextStr) : contextStr);
    }

    // Add error
    if (entry.error) {
      message += '\n' + (this.color ? chalk.red(entry.error.stack || entry.error.message) : 
        (entry.error.stack || entry.error.message));
    }

    return message;
  }

  private getLevelString(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return this.color ? chalk.gray('DEBUG') : 'DEBUG';
      case LogLevel.INFO:
        return this.color ? chalk.blue('INFO') : 'INFO';
      case LogLevel.WARN:
        return this.color ? chalk.yellow('WARN') : 'WARN';
      case LogLevel.ERROR:
        return this.color ? chalk.red('ERROR') : 'ERROR';
      case LogLevel.SUCCESS:
        return this.color ? chalk.green('SUCCESS') : 'SUCCESS';
      default:
        return 'UNKNOWN';
    }
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const message = this.formatMessage(entry);

    // Console output
    if (entry.level === LogLevel.ERROR) {
      console.error(message);
    } else {
      console.log(message);
    }

    // File output
    if (this.fileStream) {
      // eslint-disable-next-line no-control-regex
      const fileMessage = this.json ? message : message.replace(/\x1b\[[0-9;]*m/g, ''); // Remove color codes
      const data = fileMessage + '\n';
      
      this.fileStream.write(data);
      this.currentFileSize += Buffer.byteLength(data);

      // Check if rotation needed
      if (this.currentFileSize >= this.maxFileSize) {
        this.rotateFile();
      }
    }
  }

  debug(message: string, ...args: any[]): void {
    this.log({
      level: LogLevel.DEBUG,
      timestamp: new Date(),
      message: format(message, ...args),
      context: this.extractContext(args)
    });
  }

  info(message: string, ...args: any[]): void {
    this.log({
      level: LogLevel.INFO,
      timestamp: new Date(),
      message: format(message, ...args),
      context: this.extractContext(args)
    });
  }

  warn(message: string, ...args: any[]): void {
    this.log({
      level: LogLevel.WARN,
      timestamp: new Date(),
      message: format(message, ...args),
      context: this.extractContext(args)
    });
  }

  error(message: string, error?: Error | any, ...args: any[]): void {
    const isError = error instanceof Error;
    this.log({
      level: LogLevel.ERROR,
      timestamp: new Date(),
      message: format(message, ...(isError ? args : [error, ...args])),
      context: this.extractContext(args),
      error: isError ? error : undefined
    });
  }

  success(message: string, ...args: any[]): void {
    this.log({
      level: LogLevel.SUCCESS,
      timestamp: new Date(),
      message: format(message, ...args),
      context: this.extractContext(args)
    });
  }

  private extractContext(args: any[]): Record<string, any> | undefined {
    const lastArg = args[args.length - 1];
    if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg) && 
        !(lastArg instanceof Error) && !(lastArg instanceof Date)) {
      return lastArg;
    }
    return undefined;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  child(context: Record<string, any>): Logger {
    return new Logger({
      level: this.level,
      file: this.file,
      maxFileSize: this.maxFileSize,
      maxFiles: this.maxFiles,
      json: this.json,
      timestamp: this.timestamp,
      color: this.color,
      context: { ...this.context, ...context }
    });
  }

  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = undefined;
    }
  }
}

// Global logger instance
let globalLogger: Logger | null = null;

export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}

export function getGlobalLogger(): Logger {
  if (!globalLogger) {
    const logLevel = process.env.LOG_LEVEL ? 
      LogLevel[process.env.LOG_LEVEL.toUpperCase() as keyof typeof LogLevel] ?? LogLevel.INFO :
      LogLevel.INFO;

    const logFile = process.env.LOG_FILE || 
      (process.env.CI ? undefined : path.join(process.cwd(), '.re-shell', 'logs', 'cli.log'));

    globalLogger = new Logger({
      level: logLevel,
      file: logFile,
      json: process.env.LOG_JSON === 'true',
      timestamp: true,
      color: !process.env.CI && !process.env.NO_COLOR
    });
  }
  return globalLogger;
}

export function setGlobalLogger(logger: Logger): void {
  if (globalLogger) {
    globalLogger.close();
  }
  globalLogger = logger;
}