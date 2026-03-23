/**
 * Unified Error Handling and Logging for Polyglot Services
 *
 * Generates unified error handling and logging utilities:
 * - Correlation ID tracking across services
 * - Structured logging with contextual information
 * - Error classification and handling
 * - Multi-language logging implementations
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type LoggingLanguage = 'typescript' | 'python' | 'go';

export interface LoggingConfig {
  serviceName: string;
  language: LoggingLanguage;
  outputDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableCorrelation: boolean;
  enableStructuredLogs: boolean;
}

// TypeScript Error Handling and Logging
export function generateTypeScriptLogging(config: LoggingConfig): string {
  return `// Auto-generated Unified Logging for ${config.serviceName}
// Generated at: ${new Date().toISOString()}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Context = Record<string, any>;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  correlationId?: string;
  context?: Context;
  error?: Error;
}

interface AppError extends Error {
  code: string;
  statusCode: number;
  correlationId: string;
  context?: Context;
}

class UnifiedLogger {
  private serviceName: string;
  private logLevel: LogLevel;
  private enableCorrelation: boolean;
  private enableStructured: boolean;

  constructor(serviceName: string, logLevel: LogLevel = '${config.logLevel}', enableCorrelation = true, enableStructured = true) {
    this.serviceName = serviceName;
    this.logLevel = logLevel;
    this.enableCorrelation = enableCorrelation;
    this.enableStructured = enableStructured;
  }

  generateCorrelationId(): string {
    return \`ctx-\${Date.now()}-\${Math.random().toString(36).substring(2, 15)}\`;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevel = levels.indexOf(level);
    const configLevel = levels.indexOf(this.logLevel);
    return currentLevel >= configLevel;
  }

  private formatLog(entry: LogEntry): string {
    if (this.enableStructured) {
      return JSON.stringify(entry);
    }

    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase();
    const correlation = entry.correlationId ? \`[\${entry.correlationId}] \` : '';
    const service = \`[\${this.serviceName}]\`;

    let message = \`\${timestamp} \${level} \${service} \${correlation}\${entry.message}\`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      message += \` \${JSON.stringify(entry.context)}\`;
    }

    if (entry.error) {
      message += \`\\n  Stack: \${entry.error.stack}\`;
    }

    return message;
  }

  private colorize(level: LogLevel, message: string): string {
    const colors = {
      debug: '\\x1b[36m',   // cyan
      info: '\\x1b[37m',    // white
      warn: '\\x1b[33m',    // yellow
      error: '\\x1b[31m',   // red
    };
    const reset = '\\x1b[0m';
    return colors[level] + message + reset;
  }

  log(level: LogLevel, message: string, context?: Context, error?: Error, correlationId?: string): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      correlationId: correlationId || (this.enableCorrelation ? this.generateCorrelationId() : undefined),
      context,
      error,
    };

    const formatted = this.formatLog(entry);
    console.log(this.colorize(level, formatted));
  }

  debug(message: string, context?: Context): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Context): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Context): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Context): void {
    this.log('error', message, context, error);
  }

  // Error handling utilities
  createError(message: string, code: string, statusCode: number, context?: Context): AppError {
    const error = new Error(message) as AppError;
    error.code = code;
    error.statusCode = statusCode;
    error.correlationId = this.enableCorrelation ? this.generateCorrelationId() : '';
    error.context = context;
    Error.captureStackTrace(error, error);
    return error;
  }

  handleError(error: Error | AppError, context?: Context): void {
    if (this.isAppError(error)) {
      this.error(error.message, error, {
        ...context,
        code: error.code,
        statusCode: error.statusCode,
        correlationId: error.correlationId,
      });
    } else {
      this.error(error.message, error, context);
    }
  }

  private isAppError(error: Error): error is AppError {
    return 'code' in error && 'statusCode' in error;
  }

  // Middleware for Express-like frameworks
  requestLogger(correlationHeader = 'X-Correlation-ID') {
    return (req: any, res: any, next: any) => {
      const correlationId = req.headers[correlationHeader.toLowerCase()] || this.generateCorrelationId();
      req.correlationId = correlationId;

      this.info(\`Incoming \${req.method} request to \${req.path}\`, {
        method: req.method,
        path: req.path,
        headers: req.headers,
        query: req.query,
        correlationId,
      });

      res.on('finish', () => {
        this.info(\`Request completed with status \${res.statusCode}\`, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          correlationId,
        });
      });

      next();
    };
  }

  // Error handling middleware
  errorHandler() {
    return (err: Error, req: any, res: any, next: any) => {
      const correlationId = req.correlationId || this.generateCorrelationId();

      this.handleError(err, { correlationId, path: req.path });

      const statusCode = this.isAppError(err) ? err.statusCode : 500;
      const response = {
        error: {
          message: err.message,
          correlationId,
          timestamp: new Date().toISOString(),
        },
      };

      res.status(statusCode).json(response);
    };
  }

  // Async error wrapper
  async wrapAsync<T>(fn: (correlationId: string) => Promise<T>, context?: Context): Promise<T> {
    const correlationId = this.generateCorrelationId();

    try {
      this.debug('Starting async operation', { correlationId, ...context });
      const result = await fn(correlationId);
      this.debug('Async operation completed', { correlationId });
      return result;
    } catch (error) {
      this.handleError(error as Error, { correlationId, ...context });
      throw error;
    }
  }
}

// Export singleton instance
const logger = new UnifiedLogger('${config.serviceName}');

export default logger;
export { UnifiedLogger, AppError };
`;
}

// Python Error Handling and Logging
export function generatePythonLogging(config: LoggingConfig): string {
  return `# Auto-generated Unified Logging for ${config.serviceName}
# Generated at: ${new Date().toISOString()}

import uuid
import time
import json
import traceback
from typing import Dict, Any, Optional
from datetime import datetime
from contextlib import contextmanager

class AppError(Exception):
    def __init__(self, message: str, code: str, status_code: int, correlation_id: str, context: Optional[Dict] = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.correlation_id = correlation_id
        self.context = context or {}

class UnifiedLogger:
    def __init__(self, service_name: str, log_level: str = '${config.logLevel}', enable_correlation: bool = True, enable_structured: bool = True):
        self.service_name = service_name
        self.log_level = log_level
        self.enable_correlation = enable_correlation
        self.enable_structured = enable_structured
        self.levels = ['debug', 'info', 'warn', 'error']

    def generate_correlation_id(self) -> str:
        return f"ctx-{int(time.time() * 1000)}-{uuid.uuid4().hex[:12]}"

    def _should_log(self, level: str) -> bool:
        return self.levels.index(level) >= self.levels.index(self.log_level)

    def _format_log(self, level: str, message: str, correlation_id: Optional[str] = None, context: Optional[Dict] = None, error: Optional[Exception] = None) -> str:
        timestamp = datetime.now().isoformat()
        service = self.service_name
        correlation = f"[{correlation_id}] " if correlation_id else ""

        entry = {
            'timestamp': timestamp,
            'level': level.upper(),
            'service': service,
            'message': message,
        }

        if correlation_id:
            entry['correlationId'] = correlation_id
        if context:
            entry['context'] = context
        if error:
            entry['error'] = str(error)
            entry['stack'] = traceback.format_exc()

        if self.enable_structured:
            return json.dumps(entry)

        # Plain text format
        msg = f"{timestamp} {level.upper()} [{service}] {correlation}{message}"
        if context:
            msg += f" {json.dumps(context)}"
        if error:
            msg += f"\\n  Stack: {traceback.format_exc()}"

        return msg

    def _colorize(self, level: str, message: str) -> str:
        colors = {
            'debug': '\\033[36m',    # cyan
            'info': '\\033[37m',     # white
            'warn': '\\033[33m',     # yellow
            'error': '\\033[31m',    # red
        }
        reset = '\\033[0m'
        return f"{colors.get(level, '')}{message}{reset}"

    def log(self, level: str, message: str, context: Optional[Dict] = None, error: Optional[Exception] = None, correlation_id: Optional[str] = None):
        if not self._should_log(level):
            return

        if correlation_id is None and self.enable_correlation:
            correlation_id = self.generate_correlation_id()

        formatted = self._format_log(level, message, correlation_id, context, error)
        print(self._colorize(level, formatted))

    def debug(self, message: str, context: Optional[Dict] = None):
        self.log('debug', message, context)

    def info(self, message: str, context: Optional[Dict] = None):
        self.log('info', message, context)

    def warn(self, message: str, context: Optional[Dict] = None):
        self.log('warn', message, context)

    def error(self, message: str, error: Optional[Exception] = None, context: Optional[Dict] = None):
        self.log('error', message, context, error)

    # Error handling utilities
    def create_error(self, message: str, code: str, status_code: int, context: Optional[Dict] = None) -> AppError:
        correlation_id = self.generate_correlation_id() if self.enable_correlation else ''
        return AppError(message, code, status_code, correlation_id, context)

    def handle_error(self, error: Exception, context: Optional[Dict] = None):
        if isinstance(error, AppError):
            self.error(error.message, error, {
                **(context or {}),
                'code': error.code,
                'statusCode': error.status_code,
                'correlationId': error.correlation_id,
            })
        else:
            self.error(str(error), error, context)

    # Async error wrapper
    async def wrap_async(self, fn, context: Optional[Dict] = None):
        correlation_id = self.generate_correlation_id()

        try:
            self.debug('Starting async operation', {'correlationId': correlation_id, **(context or {})})
            result = await fn(correlation_id)
            self.debug('Async operation completed', {'correlationId': correlation_id})
            return result
        except Exception as error:
            self.handle_error(error, {'correlationId': correlation_id, **(context or {})})
            raise

    # Context manager for error handling
    @contextmanager
    def error_context(self, **context):
        correlation_id = self.generate_correlation_id()
        try:
            yield {'correlation_id': correlation_id, **context}
        except Exception as error:
            self.handle_error(error, {'correlationId': correlation_id, **context})
            raise


# Singleton instance
logger = UnifiedLogger('${config.serviceName}')
`;
}

// Display configuration
export function displayConfig(config: LoggingConfig): void {
  console.log(chalk.cyan('\n✨ Unified Logging Configuration\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Service Name:'), chalk.white(config.serviceName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Log Level:'), chalk.white(config.logLevel));
  console.log(chalk.yellow('Correlation IDs:'), chalk.white(config.enableCorrelation ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Structured Logs:'), chalk.white(config.enableStructuredLogs ? 'Enabled' : 'Disabled'));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Features:\n'));

  const features = [
    'Correlation ID tracking across requests',
    'Structured logging with contextual information',
    'Error classification and handling',
    'Async error wrapping with correlation',
    'Request/response logging middleware',
    'Color-coded console output',
  ];

  features.slice(0, 5).forEach((feature, index) => {
    console.log('  ' + chalk.green('✓') + ' ' + chalk.white(feature));
  });

  if (features.length > 5) {
    console.log('  ' + chalk.gray('... and ' + (features.length - 5) + ' more'));
  }

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: LoggingConfig): string {
  let content = '# Unified Logging for ' + config.serviceName + '\n\n';
  content += 'Unified error handling and logging utilities for **' + config.serviceName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Service**: ' + config.serviceName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Log Level**: ' + config.logLevel + '\n';
  content += '- **Correlation IDs**: ' + (config.enableCorrelation ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Structured Logs**: ' + (config.enableStructuredLogs ? 'Enabled' : 'Disabled') + '\n\n';

  content += '## 🚀 Installation\n\n';

  if (config.language === 'typescript') {
    content += '```bash\n';
    content += 'npm install\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```bash\n';
    content += 'pip install -r requirements.txt\n';
    content += '```\n\n';
  }

  content += '## 💻 Usage\n\n';

  if (config.language === 'typescript') {
    content += '```typescript\n';
    content += 'import logger from \'./unified-logging\';\n\n';
    content += '// Basic logging\n';
    content += 'logger.info(\'Service started\');\n';
    content += 'logger.warn(\'High memory usage\', { usage: \'85%\' });\n';
    content += 'logger.error(\'Database connection failed\', error);\n\n';
    content += '// Error handling\n';
    content += 'const error = logger.createError(\'Not found\', \'NOT_FOUND\', 404, { resource: \'user\' });\n';
    content += 'logger.handleError(error);\n\n';
    content += '// Async wrapper\n';
    content += 'const result = await logger.wrapAsync(async (corrId) => {\n';
    content += '  logger.debug(\'Processing request\', { correlationId: corrId });\n';
    content += '  return await fetchData();\n';
    content += '});\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```python\n';
    content += 'from unified_logging import logger\n\n';
    content += '# Basic logging\n';
    content += 'logger.info(\'Service started\')\n';
    content += 'logger.warn(\'High memory usage\', {\'usage\': \'85%\'})\n';
    content += 'logger.error(\'Database connection failed\', error)\n\n';
    content += '# Error handling\n';
    content += 'error = logger.create_error(\'Not found\', \'NOT_FOUND\', 404, {\'resource\': \'user\'})\n';
    content += 'logger.handle_error(error)\n\n';
    content += '# Async wrapper\n';
    content += 'result = await logger.wrap_async(lambda corr_id: \\n';
    content += '    logger.debug(\'Processing request\', {\'correlationId\': corrId})\n';
    content += '    return fetch_data()\n';
    content += '})\n';
    content += '```\n\n';
  }

  content += '## 📚 Features\n\n';
  content += '- **Correlation IDs**: Unique identifiers for tracing requests across services\n';
  content += '- **Structured Logging**: JSON-formatted logs with contextual metadata\n';
  content += '- **Error Classification**: Categorized errors with codes and status codes\n';
  content += '- **Async Wrapping**: Automatic correlation ID injection for async operations\n';
  content += '- **Color Output**: Color-coded console logs for easy reading\n';
  content += '- **Middleware Integration**: Request/response logging for web frameworks\n\n';

  content += '## 🎯 Log Levels\n\n';
  content += '- **debug**: Detailed diagnostic information\n';
  content += '- **info**: General informational messages\n';
  content += '- **warn**: Warning messages for potentially harmful situations\n';
  content += '- **error**: Error messages for critical issues\n\n';

  content += '## 🔗 Correlation IDs\n\n';
  content += 'Correlation IDs follow the format: `ctx-{timestamp}-{random}`\n\n';
  content += 'Example: `ctx-1704067200000-abc123def456`\n\n';
  content += 'These IDs help trace requests across multiple service calls.\n\n';

  return content;
}

// Write files
export async function writeLoggingFiles(
  config: LoggingConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : 'py';
  const fileName = 'unified-logging.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptLogging(config);
  } else if (config.language === 'python') {
    content = generatePythonLogging(config);
  } else {
    throw new Error('Unsupported language: ' + config.language);
  }

  await fs.ensureDir(output);
  await fs.writeFile(filePath, content);
  console.log(chalk.green('✅ Generated: ' + fileName));

  // Generate BUILD.md
  const buildMD = generateBuildMD(config);
  const buildMDPath = path.join(output, 'BUILD.md');
  await fs.writeFile(buildMDPath, buildMD);
  console.log(chalk.green('✅ Generated: BUILD.md'));

  // Generate package.json for TypeScript
  if (config.language === 'typescript') {
    const packageJson = {
      name: config.serviceName.toLowerCase() + '-unified-logging',
      version: '1.0.0',
      description: 'Unified logging for ' + config.serviceName,
      types: fileName,
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
      },
    };

    const packageJsonPath = path.join(output, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(chalk.green('✅ Generated: package.json'));
  }

  // Generate requirements.txt for Python
  if (config.language === 'python') {
    const requirements = [];

    const requirementsPath = path.join(output, 'requirements.txt');
    await fs.writeFile(requirementsPath, requirements.join('\n'));
    console.log(chalk.green('✅ Generated: requirements.txt'));
  }

  // Generate config JSON
  const loggingConfig = {
    serviceName: config.serviceName,
    language: config.language,
    logLevel: config.logLevel,
    enableCorrelation: config.enableCorrelation,
    enableStructuredLogs: config.enableStructuredLogs,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  const configPath = path.join(output, 'logging-config.json');
  await fs.writeFile(configPath, JSON.stringify(loggingConfig, null, 2));
  console.log(chalk.green('✅ Generated: logging-config.json'));
}
