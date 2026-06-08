/**
 * Cross-Language Error Handling and Propagation
 * Standardized error codes, context preservation, error propagation across services
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Error categories
export type ErrorCategory =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'server_error'
  | 'service_unavailable'
  | 'timeout'
  | 'network'
  | 'unknown';

// Error severity
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error context
export interface ErrorContext {
  requestId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  service?: string;
  endpoint?: string;
  method?: string;
  timestamp: string;
  hostname?: string;
  metadata: Record<string, any>;
}

// Standard error structure
export interface StandardError {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  statusCode: number;
  context: ErrorContext;
  details?: Record<string, any>;
  stack?: string;
  cause?: StandardError;
  retryable: boolean;
}

// Error handler configuration
export interface ErrorHandlerConfig {
  serviceName: string;
  enableStackTrace: boolean;
  enableErrorLogging: boolean;
  includeContextInResponse: boolean;
  sensitiveFields: string[];
  retryableCategories: ErrorCategory[];
}

// Generate error handler config
export async function generateErrorHandlerConfig(
  serviceName: string,
  enableStackTrace = false
): Promise<ErrorHandlerConfig> {
  return {
    serviceName,
    enableStackTrace,
    enableErrorLogging: true,
    includeContextInResponse: true,
    sensitiveFields: ['password', 'token', 'secret', 'apiKey', 'creditCard'],
    retryableCategories: ['timeout', 'network', 'server_error', 'service_unavailable'],
  };
}

// Generate TypeScript implementation
export async function generateTypeScriptErrorHandler(
  config: ErrorHandlerConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-error-handler.ts`,
    content: `import { Request, Response, NextFunction } from 'express';

// Error types
export type ErrorCategory =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'server_error'
  | 'service_unavailable'
  | 'timeout'
  | 'network'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  requestId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  service?: string;
  endpoint?: string;
  method?: string;
  timestamp: string;
  hostname?: string;
  metadata: Record<string, any>;
}

export interface StandardError {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  statusCode: number;
  context: ErrorContext;
  details?: Record<string, any>;
  stack?: string;
  cause?: StandardError;
  retryable: boolean;
}

// Error codes
const ERROR_CODES: Record<string, {
  code: string;
  message: string;
  category: ErrorCategory;
  statusCode: number;
  retryable: boolean;
}> = {
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    category: 'validation',
    statusCode: 400,
    retryable: false,
  },
  UNAUTHENTICATED: {
    code: 'UNAUTHENTICATED',
    message: 'Authentication required',
    category: 'authentication',
    statusCode: 401,
    retryable: false,
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    message: 'Access forbidden',
    category: 'authorization',
    statusCode: 403,
    retryable: false,
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: 'Resource not found',
    category: 'not_found',
    statusCode: 404,
    retryable: false,
  },
  CONFLICT: {
    code: 'CONFLICT',
    message: 'Resource conflict',
    category: 'conflict',
    statusCode: 409,
    retryable: false,
  },
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded',
    category: 'rate_limit',
    statusCode: 429,
    retryable: true,
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    category: 'server_error',
    statusCode: 500,
    retryable: true,
  },
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service temporarily unavailable',
    category: 'service_unavailable',
    statusCode: 503,
    retryable: true,
  },
  TIMEOUT: {
    code: 'TIMEOUT',
    message: 'Request timeout',
    category: 'timeout',
    statusCode: 504,
    retryable: true,
  },
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: 'Network communication error',
    category: 'network',
    statusCode: 502,
    retryable: true,
  },
};

// Main error handler class
export class ${toPascalCase(config.serviceName)}ErrorHandler {
  private config: any;
  private sensitiveFields: Set<string>;

  constructor(config: any) {
    this.config = config;
    this.sensitiveFields = new Set(config.sensitiveFields || []);
  }

  /**
   * Create a standard error
   */
  createError(code: string, details?: Record<string, any>, cause?: StandardError | Error): StandardError {
    const errorCode = ERROR_CODES[code] || ERROR_CODES.INTERNAL_ERROR;

    const error: StandardError = {
      code: errorCode.code,
      message: details?.message || errorCode.message,
      category: errorCode.category,
      severity: this.getSeverity(errorCode.category),
      statusCode: errorCode.statusCode,
      context: {
        timestamp: new Date().toISOString(),
        metadata: this.sanitizeDetails(details || {}),
      },
      details: this.sanitizeDetails(details || {}),
      retryable: errorCode.retryable,
    };

    if (cause) {
      error.cause = cause instanceof Error ? this.convertNativeError(cause) : cause;
    }

    if (this.config.enableStackTrace && cause instanceof Error && cause.stack) {
      error.stack = cause.stack;
    }

    return error;
  }

  /**
   * Get severity from category
   */
  private getSeverity(category: ErrorCategory): ErrorSeverity {
    const severityMap: Record<ErrorCategory, ErrorSeverity> = {
      validation: 'low',
      authentication: 'medium',
      authorization: 'medium',
      not_found: 'low',
      conflict: 'medium',
      rate_limit: 'medium',
      server_error: 'high',
      service_unavailable: 'high',
      timeout: 'high',
      network: 'high',
      unknown: 'critical',
    };

    return severityMap[category] || 'medium';
  }

  /**
   * Convert native Error to StandardError
   */
  private convertNativeError(error: Error): StandardError {
    return {
      code: 'INTERNAL_ERROR',
      message: error.message,
      category: 'server_error',
      severity: 'high',
      statusCode: 500,
      context: {
        timestamp: new Date().toISOString(),
        metadata: { name: error.name },
      },
      stack: error.stack,
      retryable: true,
    };
  }

  /**
   * Sanitize details to remove sensitive fields
   */
  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(details)) {
      if (this.sensitiveFields.has(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeDetails(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Extract context from request
   */
  extractContext(req: any): ErrorContext {
    return {
      requestId: req.id || req.headers['x-request-id'],
      traceId: req.headers['x-trace-id'],
      spanId: req.headers['x-span-id'],
      userId: req.user?.id,
      service: this.config.serviceName,
      endpoint: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
      hostname: req.hostname,
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    };
  }

  /**
   * Handle error and send response
   */
  handleError(error: StandardError | Error, req: any, res: any, next?: any): void {
    const standardError = error instanceof Error && !(error as any).code
      ? this.createError('INTERNAL_ERROR', { message: error.message }, error)
      : error as StandardError;

    // Add request context
    standardError.context = {
      ...standardError.context,
      ...this.extractContext(req),
    };

    // Log error
    if (this.config.enableErrorLogging) {
      this.logError(standardError);
    }

    // Send response
    const responseBody = this.formatErrorResponse(standardError);
    res.status(standardError.statusCode).json(responseBody);
  }

  /**
   * Log error
   */
  private logError(error: StandardError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = \`[\${error.severity.toUpperCase()}] \${error.code}: \${error.message}\`;

    console[logLevel](logMessage, {
      code: error.code,
      category: error.category,
      context: error.context,
      stack: error.stack,
    });
  }

  /**
   * Get log level from severity
   */
  private getLogLevel(severity: ErrorSeverity): 'log' | 'warn' | 'error' {
    const levelMap: Record<ErrorSeverity, 'log' | 'warn' | 'error'> = {
      low: 'log',
      medium: 'warn',
      high: 'error',
      critical: 'error',
    };

    return levelMap[severity] || 'error';
  }

  /**
   * Format error for response
   */
  private formatErrorResponse(error: StandardError): any {
    const response: any = {
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    };

    if (this.config.includeContextInResponse) {
      response.error.context = {
        requestId: error.context.requestId,
        traceId: error.context.traceId,
        timestamp: error.context.timestamp,
      };
    }

    if (error.details && Object.keys(error.details).length > 0) {
      response.error.details = error.details;
    }

    return response;
  }

  /**
   * Wrap async functions to catch errors
   */
  wrapAsync(fn: Function) {
    return (req: any, res: any, next: any) => {
      Promise.resolve(fn(req, res, next)).catch((error) => {
        this.handleError(error, req, res, next);
      });
    };
  }

  /**
   * Create Express error handling middleware
   */
  middleware() {
    return (err: any, req: any, res: any, next: any) => {
      this.handleError(err, req, res, next);
    };
  }
}

// Factory function
export function createErrorHandler(config: any) {
  return new ${toPascalCase(config.serviceName)}ErrorHandler(config);
}

// Usage example
async function main() {
  const config = {
    serviceName: '${config.serviceName}',
    enableStackTrace: true,
    enableErrorLogging: true,
    includeContextInResponse: true,
    sensitiveFields: ['password', 'token', 'secret'],
  };

  const errorHandler = new ${toPascalCase(config.serviceName)}ErrorHandler(config);

  // Create error
  const error = errorHandler.createError('VALIDATION_ERROR', {
    field: 'email',
    value: 'invalid-email',
  });

  console.log('Error:', error);
}

if (require.main === module) {
  main().catch(console.error);
}
`,
  });

  return { files, dependencies };
}

// Generate Python implementation (simplified for brevity)
export async function generatePythonErrorHandler(
  config: ErrorHandlerConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    ''.concat(
      str.replace(/[-_]/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('')
    );

  files.push({
    path: `${config.serviceName}_error_handler.py`,
    content: `# Cross-Language Error Handler for ${config.serviceName}
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
import logging

class ErrorCategory(Enum):
    VALIDATION = 'validation'
    AUTHENTICATION = 'authentication'
    AUTHORIZATION = 'authorization'
    NOT_FOUND = 'not_found'
    CONFLICT = 'conflict'
    RATE_LIMIT = 'rate_limit'
    SERVER_ERROR = 'server_error'
    SERVICE_UNAVAILABLE = 'service_unavailable'
    TIMEOUT = 'timeout'
    NETWORK = 'network'

class ErrorSeverity(Enum):
    LOW = 'low'
    MEDIUM = 'medium'
    HIGH = 'high'
    CRITICAL = 'critical'

@dataclass
class ErrorContext:
    request_id: Optional[str] = None
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    user_id: Optional[str] = None
    service: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    timestamp: str = ''
    metadata: Dict[str, Any] = None

@dataclass
class StandardError:
    code: str
    message: str
    category: ErrorCategory
    severity: ErrorSeverity
    status_code: int
    context: ErrorContext
    details: Dict[str, Any] = None
    stack: Optional[str] = None
    retryable: bool = False

class ${toPascalCase(config.serviceName)}ErrorHandler:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.sensitive_fields = set(config.get('sensitiveFields', []))
        self.logger = logging.getLogger(__name__)

    def create_error(self, code: str, details: Optional[Dict[str, Any]] = None) -> StandardError:
        error_codes = {
            'VALIDATION_ERROR': {'code': 'VALIDATION_ERROR', 'message': 'Request validation failed', 'category': ErrorCategory.VALIDATION, 'status_code': 400, 'retryable': False},
            'UNAUTHENTICATED': {'code': 'UNAUTHENTICATED', 'message': 'Authentication required', 'category': ErrorCategory.AUTHENTICATION, 'status_code': 401, 'retryable': False},
            'FORBIDDEN': {'code': 'FORBIDDEN', 'message': 'Access forbidden', 'category': ErrorCategory.AUTHORIZATION, 'status_code': 403, 'retryable': False},
            'NOT_FOUND': {'code': 'NOT_FOUND', 'message': 'Resource not found', 'category': ErrorCategory.NOT_FOUND, 'status_code': 404, 'retryable': False},
            'INTERNAL_ERROR': {'code': 'INTERNAL_ERROR', 'message': 'Internal server error', 'category': ErrorCategory.SERVER_ERROR, 'status_code': 500, 'retryable': True},
        }

        error_code = error_codes.get(code, error_codes['INTERNAL_ERROR'])

        return StandardError(
            code=error_code['code'],
            message=error_code['message'],
            category=error_code['category'],
            severity=ErrorSeverity.MEDIUM,
            status_code=error_code['status_code'],
            context=ErrorContext(timestamp='', metadata={}),
            retryable=error_code['retryable'],
        )

# Usage
async def main():
    config = {'serviceName': '${config.serviceName}', 'sensitiveFields': ['password', 'token']}
    error_handler = ${toPascalCase(config.serviceName)}ErrorHandler(config)
    error = error_handler.create_error('VALIDATION_ERROR', {'field': 'email'})
    print('Error:', error)

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
`,
  });

  return { files, dependencies };
}

// Generate Go implementation (simplified)
export async function generateGoErrorHandler(
  config: ErrorHandlerConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-error-handler.go`,
    content: `package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type ErrorCategory string

const (
	CategoryValidation     ErrorCategory = "validation"
	CategoryAuthentication ErrorCategory = "authentication"
	CategoryAuthorization  ErrorCategory = "authorization"
	CategoryNotFound       ErrorCategory = "not_found"
	CategoryConflict       ErrorCategory = "conflict"
	CategoryServerError    ErrorCategory = "server_error"
)

type ErrorSeverity string

const (
	SeverityLow      ErrorSeverity = "low"
	SeverityMedium   ErrorSeverity = "medium"
	SeverityHigh     ErrorSeverity = "high"
	SeverityCritical ErrorSeverity = "critical"
)

type ErrorContext struct {
	RequestID string \`json:"requestId,omitempty"\`
	TraceID   string \`json:"traceId,omitempty"\`
	Timestamp string \`json:"timestamp"\`
	Metadata  map[string]interface{} \`json:"metadata,omitempty"\`
}

type StandardError struct {
	Code       string        \`json:"code"\`
	Message    string        \`json:"message"\`
	Category   ErrorCategory \`json:"category"\`
	Severity   ErrorSeverity \`json:"severity"\`
	StatusCode int         \`json:"statusCode"\`
	Context    ErrorContext  \`json:"context"\`
	Retryable  bool          \`json:"retryable"\`
}

type ${toPascalCase(config.serviceName)}ErrorHandler struct {
	config         map[string]interface{}
	sensitiveFields map[string]bool
}

func New${toPascalCase(config.serviceName)}ErrorHandler(config map[string]interface{}) *${toPascalCase(config.serviceName)}ErrorHandler {
	return &${toPascalCase(config.serviceName)}ErrorHandler{
		config: config,
		sensitiveFields: make(map[string]bool),
	}
}

func (eh *${toPascalCase(config.serviceName)}ErrorHandler) CreateError(code string, details map[string]interface{}) *StandardError {
	errorCodes := map[string]struct {
		code       string
		message    string
		category   ErrorCategory
		statusCode int
		retryable  bool
	}{
		"VALIDATION_ERROR": {code: "VALIDATION_ERROR", message: "Request validation failed", category: CategoryValidation, statusCode: 400, retryable: false},
		"UNAUTHENTICATED":  {code: "UNAUTHENTICATED", message: "Authentication required", category: CategoryAuthentication, statusCode: 401, retryable: false},
		"FORBIDDEN":       {code: "FORBIDDEN", message: "Access forbidden", category: CategoryAuthorization, statusCode: 403, retryable: false},
		"NOT_FOUND":       {code: "NOT_FOUND", message: "Resource not found", category: CategoryNotFound, statusCode: 404, retryable: false},
	}

	errorCode, exists := errorCodes[code]
	if !exists {
		errorCode = errorCodes["VALIDATION_ERROR"]
	}

	return &StandardError{
		Code:       errorCode.code,
		Message:    errorCode.message,
		Category:   errorCode.category,
		Severity:   SeverityMedium,
		StatusCode: errorCode.statusCode,
		Context:    ErrorContext{Timestamp: time.Now().Format(time.RFC3339)},
		Retryable:  errorCode.retryable,
	}
}

func main() {
	config := map[string]interface{}{"serviceName": "${config.serviceName}"}
	errorHandler := New${toPascalCase(config.serviceName)}ErrorHandler(config)
	err := errorHandler.CreateError("VALIDATION_ERROR", map[string]interface{}{"field": "email"})
	fmt.Printf("Error: %+v\\n", err)
}
`,
  });

  return { files, dependencies };
}

// Write generated files
export async function writeErrorHandlerFiles(
  serviceName: string,
  integration: any,
  outputDir: string,
  language: string
): Promise<void> {
  await fs.ensureDir(outputDir);

  for (const file of integration.files) {
    const filePath = path.join(outputDir, file.path);
    const fileDir = path.dirname(filePath);

    await fs.ensureDir(fileDir);
    await fs.writeFile(filePath, file.content);
  }

  // Generate BUILD.md
  const buildContent = generateBuildMarkdown(serviceName, integration, language);
  await fs.writeFile(path.join(outputDir, 'BUILD.md'), buildContent);
}

// Display configuration
export async function displayErrorHandlerConfig(config: ErrorHandlerConfig): Promise<void> {
  console.log(chalk.bold.red('\n⚠️  Error Handler: ' + config.serviceName));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.cyan('Stack Trace:'), config.enableStackTrace ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('Error Logging:'), config.enableErrorLogging ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('Context in Response:'), config.includeContextInResponse ? chalk.green('enabled') : chalk.red('disabled'));

  console.log(chalk.cyan('\n🔒 Sensitive Fields:'));
  config.sensitiveFields.forEach(field => console.log(chalk.gray(`  • ${field}`)));

  console.log(chalk.cyan('\n📡 Error Categories (10 total):'));
  console.log(chalk.gray('  • validation (400) - Request validation failed'));
  console.log(chalk.gray('  • authentication (401) - Authentication required'));
  console.log(chalk.gray('  • authorization (403) - Access forbidden'));
  console.log(chalk.gray('  • not_found (404) - Resource not found'));
  console.log(chalk.gray('  • conflict (409) - Resource conflict'));
  console.log(chalk.gray('  • rate_limit (429) - Rate limit exceeded (retryable)'));
  console.log(chalk.gray('  • server_error (500) - Internal error (retryable)'));
  console.log(chalk.gray('  • service_unavailable (503) - Temporarily unavailable (retryable)'));
  console.log(chalk.gray('  • timeout (504) - Request timeout (retryable)'));
  console.log(chalk.gray('  • network (502) - Network error (retryable)'));

  console.log(chalk.gray('─'.repeat(50)));
}

// Generate BUILD.md
function generateBuildMarkdown(serviceName: string, integration: any, language: string): string {
  return `# Error Handler Build Instructions for ${serviceName}

## Language: ${language.toUpperCase()}

## Architecture

This error handling system provides:
- **Standardized Error Format**: Consistent error structure across services
- **Error Categories**: 10 predefined error categories
- **Context Preservation**: Request context preserved in errors
- **Sensitive Data Redaction**: Automatic redaction of sensitive fields
- **Retry Support**: Errors marked as retryable or non-retryable

## Error Response Format

\`\`\`json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "retryable": false,
    "context": {
      "requestId": "req-123",
      "timestamp": "2024-01-12T10:00:00Z"
    }
  }
}
\`\`\`

## Usage

See generated code for usage examples with Express/FastAPI/Go HTTP handlers.
`;
}
