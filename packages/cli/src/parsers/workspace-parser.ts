// Workspace YAML Parser with Validation
// Parse and validate re-shell.workspaces.yaml files

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import Ajv from 'ajv';
import { join } from 'path';
import workspaceSchemaJson from '../schemas/workspace-v2.schema.json';

export interface WorkspaceConfig {
  name: string;
  version: string;
  description?: string;
  metadata?: Record<string, any>;
  variables?: Record<string, string | number | boolean>;
  config?: Record<string, any>;
  services: Record<string, ServiceConfig>;
  dependencies?: {
    databases?: any[];
    caches?: any[];
    queues?: any[];
    storage?: any[];
  };
  deployment?: any;
  monitoring?: any;
}

export interface ServiceConfig {
  name: string;
  displayName?: string;
  description?: string;
  type?: 'frontend' | 'backend' | 'worker' | 'function';
  language: string;
  framework: string | FrameworkConfig;
  path?: string;
  port?: number;
  env?: Record<string, string>;
  dependencies?: {
    production?: Record<string, string>;
    development?: Record<string, string>;
  };
  scripts?: Record<string, string>;
  build?: any;
  scaling?: any;
  resources?: any;
  healthCheck?: any;
  routes?: any[];
  middleware?: any[];
  features?: string[];
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface FrameworkConfig {
  name: string;
  version: string;
  config?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  config?: WorkspaceConfig;
}

export interface ValidationError {
  path: string;
  message: string;
  value?: any;
}

export interface ValidationWarning {
  path: string;
  message: string;
  value?: any;
}

export class WorkspaceParser {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      validateFormats: false,
    });
  }

  /**
   * Parse workspace YAML file
   */
  parse(filePath: string): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Read file
      if (!fs.existsSync(filePath)) {
        result.errors.push({
          path: 'file',
          message: `Workspace file not found: \${filePath}`,
        });
        result.valid = false;
        return result;
      }

      const content = fs.readFileSync(filePath, 'utf8');

      // Parse YAML with detailed error messages
      let config: any;
      try {
        config = yaml.load(content, {
          filename: filePath,
          onWarning: (warning: any) => {
            result.warnings.push({
              path: 'yaml',
              message: `YAML warning: ${warning.message}`,
            });
          },
        });
      } catch (error: any) {
        // Enhanced YAML error reporting with line numbers
        const yamlError = error as yaml.YAMLException;
        const errorMsg = yamlError.message || 'Unknown YAML error';
        const mark = yamlError.mark;

        if (mark) {
          // Provide detailed error location
          result.errors.push({
            path: `yaml:${filePath}:${mark.line + 1}:${mark.column + 1}`,
            message: `YAML syntax error at line ${mark.line + 1}, column ${mark.column + 1}: ${errorMsg}`,
            value: {
              line: mark.line + 1,
              column: mark.column + 1,
              snippet: extractErrorSnippet(content, mark.line, mark.column),
            },
          });
        } else {
          result.errors.push({
            path: 'yaml',
            message: `YAML parsing error: ${errorMsg}`,
          });
        }
        result.valid = false;
        return result;
      }

      // Validate against JSON schema
      const validate = this.ajv.compile(workspaceSchemaJson);
      const valid = validate(config);

      if (!valid && validate.errors) {
        for (const error of validate.errors) {
          result.errors.push({
            path: error.instancePath || 'root',
            message: error.message || 'Validation failed',
            value: error.data,
          });
        }
        result.valid = false;
        return result;
      }

      // Custom validation rules
      this.validateCustomRules(config, result);

      if (result.valid || result.errors.length === 0) {
        result.config = config as WorkspaceConfig;
      }

      return result;
    } catch (error: any) {
      result.errors.push({
        path: 'parser',
        message: `Unexpected error: \${error.message}`,
      });
      result.valid = false;
      return result;
    }
  }

  /**
   * Validate custom business rules beyond JSON schema
   */
  private validateCustomRules(config: any, result: ValidationResult): void {
    // Validate service names
    if (config.services) {
      for (const [serviceName, service] of Object.entries(config.services)) {
        const serviceConfig = service as ServiceConfig;

        // Check service name matches
        if (serviceConfig.name !== serviceName) {
          result.errors.push({
            path: `services.\${serviceName}.name`,
            message: `Service name must match key: expected "\${serviceName}", got "\${serviceConfig.name}"`,
            value: serviceConfig.name,
          });
        }

        // Validate language exists
        const supportedLanguages = [
          'typescript', 'javascript', 'python', 'go', 'rust', 'java',
          'kotlin', 'scala', 'csharp', 'fsharp', 'php', 'ruby', 'elixir',
          'clojure', 'haskell', 'swift', 'dart', 'crystal', 'zig', 'nim',
          'v', 'deno', 'bun'
        ];

        if (!supportedLanguages.includes(serviceConfig.language)) {
          result.errors.push({
            path: `services.\${serviceName}.language`,
            message: `Unsupported language: \${serviceConfig.language}`,
            value: serviceConfig.language,
          });
        }

        // Validate framework matches language
        this.validateFramework(serviceName, serviceConfig, result);

        // Validate port is within range
        if (serviceConfig.port) {
          if (serviceConfig.port < 1024 || serviceConfig.port > 65535) {
            result.errors.push({
              path: `services.\${serviceName}.port`,
              message: `Port must be between 1024 and 65535`,
              value: serviceConfig.port,
            });
          }
        }

        // Validate build configuration
        if (serviceConfig.build) {
          this.validateBuildConfig(serviceName, serviceConfig.build, result);
        }

        // Validate resource limits
        if (serviceConfig.resources) {
          this.validateResourceConfig(serviceName, serviceConfig.resources, result);
        }

        // Validate dependencies don't conflict
        if (serviceConfig.dependencies) {
          this.validateDependencies(serviceName, serviceConfig.dependencies, result);
        }
      }
    }

    // Check for port conflicts
    this.validatePortConflicts(config, result);

    // Check for circular dependencies
    this.validateCircularDependencies(config, result);
  }

  private validateFramework(serviceName: string, service: ServiceConfig, result: ValidationResult): void {
    const frameworkType = typeof service.framework;
    const frameworkName: string = frameworkType === 'string'
      ? (service.framework as string)
      : (service.framework as FrameworkConfig).name;

    const supportedFrameworks: Record<string, string[]> = {
      typescript: ['react', 'vue', 'angular', 'svelte', 'express', 'nestjs', 'fastify', 'koa', 'next', 'nuxt'],
      javascript: ['react', 'vue', 'angular', 'svelte', 'express', 'koa', 'fastify'],
      python: ['fastapi', 'django', 'flask', 'tornado', 'sanic'],
      go: ['gin', 'fiber', 'echo', 'buffalo'],
      rust: ['actix', 'rocket', 'axum'],
      java: ['spring-boot', 'quarkus', 'micronaut', 'vertx'],
      ruby: ['rails', 'sinatra', 'grape'],
      php: ['laravel', 'symfony', 'slim'],
    };

    const frameworks = supportedFrameworks[service.language];
    if (frameworks && !frameworks.includes(frameworkName)) {
      result.errors.push({
        path: `services.${serviceName}.framework`,
        message: `Framework "${frameworkName}" is not supported for language "${service.language}". Supported: ${frameworks.join(', ')}`,
        value: frameworkName,
      });
    }
  }

  private validateBuildConfig(serviceName: string, build: any, result: ValidationResult): void {
    if (build.dockerfile && !build.context) {
      result.warnings.push({
        path: `services.\${serviceName}.build`,
        message: 'Dockerfile specified but no build context provided',
      });
    }

    if (build.output && !build.context) {
      result.warnings.push({
        path: `services.\${serviceName}.build`,
        message: 'Output directory specified but no build context provided',
      });
    }
  }

  private validateResourceConfig(serviceName: string, resources: any, result: ValidationResult): void {
    if (resources.cpu) {
      if (resources.cpu.request) {
        const match = resources.cpu.request.match(/^([0-9]+)m$/);
        if (!match) {
          result.errors.push({
            path: `services.\${serviceName}.resources.cpu.request`,
            message: 'CPU request must be in format "<number>m" (e.g., "100m")',
            value: resources.cpu.request,
          });
        }
      }

      if (resources.cpu.limit) {
        const match = resources.cpu.limit.match(/^([0-9]+)m$/);
        if (!match) {
          result.errors.push({
            path: `services.\${serviceName}.resources.cpu.limit`,
            message: 'CPU limit must be in format "<number>m" (e.g., "500m")',
            value: resources.cpu.limit,
          });
        }
      }
    }

    if (resources.memory) {
      if (resources.memory.request) {
        const match = resources.memory.request.match(/^([0-9]+)(Mi|Gi)$/);
        if (!match) {
          result.errors.push({
            path: `services.\${serviceName}.resources.memory.request`,
            message: 'Memory request must be in format "<number>Mi" or "<number>Gi" (e.g., "256Mi")',
            value: resources.memory.request,
          });
        }
      }

      if (resources.memory.limit) {
        const match = resources.memory.limit.match(/^([0-9]+)(Mi|Gi)$/);
        if (!match) {
          result.errors.push({
            path: `services.\${serviceName}.resources.memory.limit`,
            message: 'Memory limit must be in format "<number>Mi" or "<number>Gi" (e.g., "512Mi")',
            value: resources.memory.limit,
          });
        }
      }
    }
  }

  private validateDependencies(serviceName: string, dependencies: any, result: ValidationResult): void {
    const allDeps = { ...dependencies.production, ...dependencies.development };

    // Check for conflicting versions
    const versionMap: Record<string, string[]> = {};
    for (const [dep, version] of Object.entries(allDeps)) {
      if (!versionMap[dep]) {
        versionMap[dep] = [];
      }
      versionMap[dep].push(version as string);
    }

    for (const [dep, versions] of Object.entries(versionMap)) {
      if (versions.length > 1 && new Set(versions).size > 1) {
        result.warnings.push({
          path: `services.\${serviceName}.dependencies`,
          message: `Dependency "\${dep}" has different versions in production and development: \${versions.join(', ')}`,
        });
      }
    }
  }

  private validatePortConflicts(config: any, result: ValidationResult): void {
    const portMap: Record<number, string[]> = {};

    for (const [serviceName, service] of Object.entries(config.services || {})) {
      const port = (service as ServiceConfig).port;
      if (port) {
        if (!portMap[port]) {
          portMap[port] = [];
        }
        portMap[port].push(serviceName);
      }
    }

    for (const [port, services] of Object.entries(portMap)) {
      if (services.length > 1) {
        result.errors.push({
          path: 'services',
          message: `Port conflict: Port \${port} is used by multiple services: \${services.join(', ')}`,
          value: port,
        });
      }
    }
  }

  private validateCircularDependencies(config: any, result: ValidationResult): void {
    const graph = this.buildDependencyGraph(config);
    const cycles = this.detectCycles(graph);

    if (cycles.length > 0) {
      for (const cycle of cycles) {
        result.errors.push({
          path: 'services',
          message: `Circular dependency detected: \${cycle.join(' -> ')}`,
        });
      }
    }
  }

  private buildDependencyGraph(config: any): Record<string, string[]> {
    const graph: Record<string, string[]> = {};

    for (const [serviceName, service] of Object.entries(config.services || {})) {
      graph[serviceName] = [];

      // Add dependencies based on what service depends on
      const routes = (service as ServiceConfig).routes || [];
      for (const route of routes) {
        if (route.target && route.target.startsWith('service://')) {
          const targetService = route.target.replace('service://', '');
          graph[serviceName].push(targetService);
        }
      }
    }

    return graph;
  }

  private detectCycles(graph: Record<string, string[]>): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      for (const neighbor of graph[node] || []) {
        if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          cycles.push([...path.slice(cycleStart), neighbor]);
        } else if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        }
      }

      path.pop();
      recursionStack.delete(node);
    };

    for (const node of Object.keys(graph)) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Extract error snippet from YAML content
   */
  private extractErrorSnippet(content: string, errorLine: number, errorColumn: number, contextLines = 2): string {
    const lines = content.split('\n');
    const start = Math.max(0, errorLine - contextLines);
    const end = Math.min(lines.length, errorLine + contextLines + 1);

    let snippet = '';
    for (let i = start; i < end; i++) {
      const prefix = i === errorLine ? '> ' : '  ';
      snippet += prefix + lines[i] + '\n';
      if (i === errorLine && errorColumn > 0) {
        snippet += '  ' + ' '.repeat(errorColumn) + '^\n';
      }
    }

    return snippet.trim();
  }

  /**
   * Format validation errors for display
   */
  formatErrors(result: ValidationResult): string {
    if (result.valid) {
      return '✅ Workspace configuration is valid';
    }

    let message = '❌ Validation failed:\\n\\n';

    if (result.errors.length > 0) {
      message += 'Errors:\\n';
      for (const error of result.errors) {
        message += `  • [\${error.path}] \${error.message}`;
        if (error.value !== undefined) {
          message += ` (value: \${JSON.stringify(error.value)})`;
        }
        message += '\\n';
      }
    }

    if (result.warnings.length > 0) {
      message += '\\nWarnings:\\n';
      for (const warning of result.warnings) {
        message += `  • [\${warning.path}] \${warning.message}\\n`;
      }
    }

    return message;
  }
}

// Helper function to extract error snippet (used in catch block)
function extractErrorSnippet(content: string, errorLine: number, errorColumn: number, contextLines = 2): string {
  const lines = content.split('\n');
  const start = Math.max(0, errorLine - contextLines);
  const end = Math.min(lines.length, errorLine + contextLines + 1);

  let snippet = '';
  for (let i = start; i < end; i++) {
    const prefix = i === errorLine ? '> ' : '  ';
    snippet += prefix + (lines[i] || '') + '\n';
    if (i === errorLine && errorColumn > 0) {
      snippet += '  ' + ' '.repeat(errorColumn) + '^\n';
    }
  }

  return snippet.trim();
}

// Export singleton instance
export const workspaceParser = new WorkspaceParser();
