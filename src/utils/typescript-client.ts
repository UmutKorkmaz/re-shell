/**
 * TypeScript Client Generator
 * Generates type-safe API clients from OpenAPI/Swagger specifications
 */

import * as fs from 'fs-extra';
import * as path from 'path';

// OpenAPI types
export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, Schema>;
    responses?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    requestBodies?: Record<string, unknown>;
  };
  definitions?: Record<string, Schema>; // Swagger 2.0
}

export interface PathItem {
  get?: Operation;
  put?: Operation;
  post?: Operation;
  delete?: Operation;
  options?: Operation;
  head?: Operation;
  patch?: Operation;
  trace?: Operation;
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  security?: unknown[];
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: Schema;
  type?: string;
  enum?: (string | number)[];
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, MediaType>;
  schema?: Schema;
}

export interface MediaType {
  schema?: Schema;
}

export interface Response {
  description?: string;
  content?: Record<string, MediaType>;
  schema?: Schema; // Swagger 2.0
}

export interface Schema {
  $ref?: string;
  type?: string;
  format?: string;
  enum?: (string | number)[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  additionalProperties?: boolean | Schema;
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  description?: string;
  title?: string;
  default?: unknown;
  example?: unknown;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

// Client generation options
export interface ClientOptions {
  spec?: OpenAPISpec;
  clientName?: string;
  baseUrl?: string;
  useAxios?: boolean;
  includeCredentials?: boolean;
  includeRetry?: boolean;
  includeCache?: boolean;
  exportType?: 'default' | 'named' | 'module';
  emitDeprecatedMethods?: boolean;
  useEnumTypes?: boolean;
  port?: number;
}

// Generate TypeScript type from OpenAPI schema
export function generateType(schema: Schema, name = 'Anonymous', refs = new Set<string>()): string {
  if (schema.$ref) {
    const refName = getRefName(schema.$ref);
    if (refs.has(refName)) {
      return refName;
    }
    refs.add(refName);
    return refName;
  }

  if (schema.enum) {
    const enumValues = schema.enum.map(v => typeof v === 'string' ? `'${v}'` : String(v));
    return enumValues.join(' | ');
  }

  if (schema.allOf) {
    const types = schema.allOf.map(s => generateType(s, name, refs));
    return `(${types.join(' & ')})`;
  }

  if (schema.oneOf) {
    const types = schema.oneOf.map(s => generateType(s, name, refs));
    return `(${types.join(' | ')})`;
  }

  if (schema.anyOf) {
    const types = schema.anyOf.map(s => generateType(s, name, refs));
    return `(${types.join(' | ')})`;
  }

  const baseType = getBaseType(schema);
  if (!baseType) {
    return 'unknown';
  }

  if (baseType === 'array' && schema.items) {
    const itemType = generateType(schema.items, `${name}Item`, refs);
    return `${itemType}[]`;
  }

  if (baseType === 'object') {
    if (!schema.properties || Object.keys(schema.properties).length === 0) {
      return 'Record<string, unknown>';
    }

    const props = Object.entries(schema.properties).map(([propName, propSchema]) => {
      const isRequired = schema.required?.includes(propName);
      const propType = generateType(propSchema, `${name}${capitalize(propName)}`, new Set(refs));
      const optional = isRequired ? '' : '?';
      return `  ${propName}${optional}: ${propType};`;
    });

    if (schema.additionalProperties) {
      const additionalType = typeof schema.additionalProperties === 'object'
        ? generateType(schema.additionalProperties, `${name}Additional`, refs)
        : 'unknown';
      props.push(`  [key: string]: ${additionalType};`);
    }

    return `{\n${props.join('\n')}\n}`;
  }

  return baseType;
}

// Get base TypeScript type from OpenAPI type
function getBaseType(schema: Schema): string | null {
  if (!schema.type) {
    return null;
  }

  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    integer: 'number',
    boolean: 'boolean',
    array: 'array',
    object: 'object',
  };

  const baseType = typeMap[schema.type];

  if (baseType === 'string' && schema.format) {
    const formatMap: Record<string, string> = {
      date: 'string',
      'date-time': 'string',
      email: 'string',
      uri: 'string',
      url: 'string',
      uuid: 'string',
      binary: 'string',
      byte: 'string',
      password: 'string',
    };
    return formatMap[schema.format] || 'string';
  }

  return baseType;
}

// Extract reference name from $ref
function getRefName(ref: string): string {
  const parts = ref.split('/');
  return parts[parts.length - 1] || 'Unknown';
}

// Capitalize first letter
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Convert operation ID to method name
export function toMethodName(operationId: string): string {
  return operationId
    .replace(/[^a-zA-Z0-9]/g, '_')
    .split('_')
    .map((word, i) => i === 0 ? word : capitalize(word))
    .join('');
}

// Generate TypeScript interfaces from OpenAPI spec
export function generateInterfaces(spec: OpenAPISpec): string {
  const lines: string[] = [];
  lines.push('// Auto-generated TypeScript types from OpenAPI specification');
  lines.push(`// ${spec.info.title} v${spec.info.version}`);
  lines.push('');
  lines.push('export interface RequestConfig {');
  lines.push('  signal?: AbortSignal;');
  lines.push('  headers?: Record<string, string>;');
  lines.push('  timeout?: number;');
  lines.push('}');
  lines.push('');

  // Generate interfaces from components/schemas or definitions
  const schemas = spec.components?.schemas || spec.definitions || {};
  Object.entries(schemas).forEach(([name, schema]) => {
    lines.push(`export interface ${name} {`);
    if (schema.description) {
      lines.push(`  /** ${schema.description} */`);
    }

    const props: string[] = [];
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([propName, propSchema]) => {
        const isRequired = schema.required?.includes(propName);
        const propType = generateType(propSchema, `${name}${capitalize(propName)}`, new Set());
        const optional = isRequired ? '' : '?';
        const comment = propSchema.description ? ` /** ${propSchema.description} */` : '';
        props.push(`  ${propName}${optional}: ${propType};${comment}`);
      });
    }

    if (schema.additionalProperties) {
      const additionalType = typeof schema.additionalProperties === 'object'
        ? generateType(schema.additionalProperties, `${name}Additional`, new Set())
        : 'unknown';
      props.push(`  [key: string]: ${additionalType};`);
    }

    if (props.length === 0) {
      props.push('  [key: string]: unknown;');
    }

    lines.push(props.join('\n'));
    lines.push('}');
    lines.push('');
  });

  // Generate enum types
  Object.entries(schemas).forEach(([name, schema]) => {
    if (schema.enum) {
      lines.push(`export type ${name} = ${generateType(schema, name, new Set())};`);
      lines.push('');
    }
  });

  return lines.join('\n');
}

// Generate API client methods
export function generateClientMethods(spec: OpenAPISpec, options: ClientOptions): string {
  const lines: string[] = [];

  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;

      const opId = operation.operationId || toMethodName(`${method}_${path}`);
      const methodName = toMethodName(opId);
      const description = operation.description || operation.summary || '';
      const httpMethod = method.toUpperCase();

      // Parse parameters
      const pathParams = (operation.parameters || []).filter((p: Parameter) => p.in === 'path');
      const queryParams = (operation.parameters || []).filter((p: Parameter) => p.in === 'query');
      const headerParams = (operation.parameters || []).filter((p: Parameter) => p.in === 'header');

      const hasPathParams = pathParams.length > 0;
      const hasQueryParams = queryParams.length > 0;
      const hasHeaderParams = headerParams.length > 0;

      // Build method signature
      lines.push(`/**`);
      if (description) lines.push(` * ${description}`);
      lines.push(` * @ HTTP ${httpMethod} ${path}`);
      lines.push(` */`);

      const hasBody = operation.requestBody;
      const hasConfig = true; // Always have config option

      // Build parameter interface
      const params: string[] = [];

      if (hasPathParams) {
        pathParams.forEach((p: Parameter) => {
          const paramType = p.schema ? generateType(p.schema, `${capitalize(p.name)}Param`, new Set()) : 'string';
          params.push(`  ${p.name}: ${paramType};${p.required ? '' : '?'}`);
        });
      }

      if (hasQueryParams) {
        params.push(`  query?: {`);
        queryParams.forEach((p: Parameter) => {
          const paramType = p.schema ? generateType(p.schema, `${capitalize(p.name)}Query`, new Set()) : 'string';
          params.push(`    ${p.name}?: ${paramType};`);
        });
        params.push(`  };`);
      }

      if (hasHeaderParams) {
        params.push(`  headers?: {`);
        headerParams.forEach((p: Parameter) => {
          const paramType = p.schema ? generateType(p.schema, `${capitalize(p.name)}Header`, new Set()) : 'string';
          params.push(`    ${p.name}?: ${paramType};`);
        });
        params.push(`  };`);
      }

      if (hasBody) {
        const content = operation.requestBody.content || {};
        const jsonSchema = content['application/json']?.schema || content['*/*']?.schema || operation.requestBody.schema;
        if (jsonSchema) {
          const bodyType = generateType(jsonSchema, 'RequestBody', new Set());
          params.push(`  body: ${bodyType};`);
        } else {
          params.push(`  body: unknown;`);
        }
      }

      // Build method
      let methodSig = `async ${methodName}(`;

      if (params.length > 0) {
        methodSig += `params: {\n${params.join('\n')}\n  }, `;
      }

      methodSig += `config?: RequestConfig`;

      // Determine response type
      const successResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['204'];
      let responseType = 'void';

      if (successResponse) {
        const content = (successResponse as Response).content;
        if (content?.['application/json']?.schema) {
          responseType = generateType(content['application/json'].schema, 'Response', new Set());
        } else if ((successResponse as Response).schema) {
          responseType = generateType((successResponse as Response).schema, 'Response', new Set());
        } else {
          responseType = 'unknown';
        }
      }

      methodSig += `): Promise<${responseType}>`;

      lines.push(methodSig + ' {');
      lines.push(`  const url = this.buildUrl('${path}'`);

      if (hasPathParams) {
        pathParams.forEach((p: Parameter) => {
          lines.push(`    .replace('{${p.name}}', encodeURIComponent(String(params.${p.name})))`);
        });
      }

      lines.push(`  );`);

      // Build query string
      if (hasQueryParams) {
        lines.push(`  const queryString = new URLSearchParams();`);
        lines.push(`  if (params.query) {`);
        queryParams.forEach((p: Parameter) => {
          lines.push(`    if (params.query.${p.name} !== undefined) {`);
          lines.push(`      queryString.append('${p.name}', String(params.query.${p.name}));`);
          lines.push(`    }`);
        });
        lines.push(`  }`);
        lines.push(`  const fullUrl = queryString.toString() ? \`\${url}?\${queryString}\` : url;`);
      } else {
        lines.push(`  const fullUrl = url;`);
      }

      // Build headers
      lines.push(`  const headers = {`);
      lines.push(`    'Content-Type': 'application/json',`);
      lines.push(`    ...this.defaultHeaders,`);
      lines.push(`    ...config?.headers,`);

      if (hasHeaderParams) {
        lines.push(`    ...(params.headers || {}),`);
      }

      lines.push(`  };`);

      // Build request
      if (options.useAxios) {
        lines.push(`  const response = await this.axios.${httpMethod.toLowerCase()}(fullUrl, {`);
        if (hasBody) {
          lines.push(`    data: params.body,`);
        }
        lines.push(`    headers,`);
        lines.push(`    signal: config?.signal,`);
        lines.push(`  });`);
        lines.push(`  return response.data as ${responseType};`);
      } else {
        lines.push(`  const response = await fetch(fullUrl, {`);
        lines.push(`    method: '${httpMethod}',`);
        if (hasBody) {
          lines.push(`    body: JSON.stringify(params.body),`);
        }
        lines.push(`    headers,`);
        lines.push(`    signal: config?.signal,`);
        lines.push(`  });`);

        lines.push(`  if (!response.ok) {`);
        lines.push(`    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);`);
        lines.push(`  }`);

        if (responseType === 'void') {
          lines.push(`  return;`);
        } else if (responseType === 'unknown') {
          lines.push(`  return await response.json();`);
        } else {
          lines.push(`  return await response.json() as ${responseType};`);
        }
      }

      lines.push(`}`);
      lines.push(``);
    });
  });

  return lines.join('\n');
}

// Generate the complete client class
export function generateClient(spec: OpenAPISpec, options: ClientOptions): string {
  const clientName = options.clientName || `${toCamelCase(spec.info.title)}Client`;
  const baseUrl = options.baseUrl || spec.servers?.[0]?.url || '';

  const lines: string[] = [];

  // Add imports
  if (options.useAxios) {
    lines.push(`import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';`);
  } else {
    lines.push(`// Using native fetch API`);
  }
  lines.push('');

  // Add interfaces
  lines.push(generateInterfaces(spec));
  lines.push('');

  // Add client class
  lines.push(`export class ${clientName} {`);
  lines.push(`  private baseUrl: string;`);
  lines.push(`  private defaultHeaders: Record<string, string>;`);

  if (options.useAxios) {
    lines.push(`  private axios: AxiosInstance;`);
  }

  lines.push('');
  lines.push(`  constructor(config?: {`);
  lines.push(`    baseUrl?: string;`);
  lines.push(`    headers?: Record<string, string>;`);
  if (options.includeCredentials) {
    lines.push(`    credentials?: RequestCredentials;`);
  }
  lines.push(`  }) {`);
  lines.push(`    this.baseUrl = config?.baseUrl || '${baseUrl}';`);
  lines.push(`    this.defaultHeaders = config?.headers || {};`);

  if (options.useAxios) {
    lines.push(`    this.axios = axios.create({`);
    lines.push(`      baseURL: this.baseUrl,`);
    if (options.includeCredentials) {
      lines.push(`      withCredentials: true,`);
    }
    lines.push(`    });`);
  }

  lines.push(`  }`);
  lines.push('');

  // Helper methods
  lines.push(`  private buildUrl(path: string): string {`);
  lines.push(`    return \`\${this.baseUrl.replace(/\\/$/, '')}\${path}\`;`);
  lines.push(`  }`);
  lines.push('');

  // API methods
  lines.push(generateClientMethods(spec, options));

  lines.push(`}`);

  return lines.join('\n');
}

// ==================== ENHANCED CLIENT WITH RETRY, CACHING, ERROR HANDLING ====================

/**
 * Generate enhanced API client with retry, caching, and intelligent error handling
 */
export function generateEnhancedClient(spec: OpenAPISpec, options: ClientOptions): string {
  const clientName = options.clientName || `${toCamelCase(spec.info.title)}Client`;
  const baseUrl = options.baseUrl || spec.servers?.[0]?.url || '';
  const includeRetry = options.includeRetry ?? true;
  const includeCache = options.includeCache ?? true;

  const lines: string[] = [];

  // Add imports
  if (options.useAxios) {
    lines.push(`import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';`);
  } else {
    lines.push(`// Using native fetch API`);
  }
  lines.push('');

  // Add interfaces
  lines.push(generateInterfaces(spec));
  lines.push('');

  // Add enhanced interfaces for retry and cache config
  if (includeRetry || includeCache) {
    lines.push(`// Enhanced configuration interfaces`);
    lines.push(`export interface RetryConfig {`);
    lines.push(`  maxRetries?: number;`);
    lines.push(`  retryDelay?: number;`);
    lines.push(`  backoffMultiplier?: number;`);
    lines.push(`  retryableStatusCodes?: number[];`);
    lines.push(`  onRetry?: (attempt: number, error: Error) => void;`);
    lines.push(`}`);
    lines.push(``);
  }

  if (includeCache) {
    lines.push(`export interface CacheConfig {`);
    lines.push(`  enabled?: boolean;`);
    lines.push(`  ttl?: number; // Time to live in milliseconds`);
    lines.push(`  maxSize?: number;`);
    lines.push(`  cacheKeyGenerator?: (url: string, params: any) => string;`);
    lines.push(`}`);
    lines.push(``);
    lines.push(`interface CacheEntry {`);
    lines.push(`  data: unknown;`);
    lines.push(`  timestamp: number;`);
    lines.push(`  ttl: number;`);
    lines.push(`}`);
    lines.push(``);
  }

  // Add enhanced client class
  lines.push(`export class ${clientName} {`);
  lines.push(`  private baseUrl: string;`);
  lines.push(`  private defaultHeaders: Record<string, string>;`);

  if (options.useAxios) {
    lines.push(`  private axios: AxiosInstance;`);
  }

  if (includeCache) {
    lines.push(`  private cache: Map<string, CacheEntry>;`);
    lines.push(`  private cacheConfig: CacheConfig;`);
  }

  if (includeRetry) {
    lines.push(`  private retryConfig: RetryConfig;`);
  }

  lines.push('');
  lines.push(`  constructor(config?: {`);
  lines.push(`    baseUrl?: string;`);
  lines.push(`    headers?: Record<string, string>;`);
  if (options.includeCredentials) {
    lines.push(`    credentials?: RequestCredentials;`);
  }
  if (includeRetry) {
    lines.push(`    retry?: Partial<RetryConfig>;`);
  }
  if (includeCache) {
    lines.push(`    cache?: Partial<CacheConfig>;`);
  }
  lines.push(`  }) {`);
  lines.push(`    this.baseUrl = config?.baseUrl || '${baseUrl}';`);
  lines.push(`    this.defaultHeaders = config?.headers || {};`);

  if (includeCache) {
    lines.push(`    this.cache = new Map();`);
    lines.push(`    this.cacheConfig = {`);
    lines.push(`      enabled: config?.cache?.enabled ?? true,`);
    lines.push(`      ttl: config?.cache?.ttl ?? 60000, // 1 minute default`);
    lines.push(`      maxSize: config?.cache?.maxSize ?? 100,`);
    lines.push(`      cacheKeyGenerator: config?.cache?.cacheKeyGenerator,`);
    lines.push(`    };`);
  }

  if (includeRetry) {
    lines.push(`    this.retryConfig = {`);
    lines.push(`      maxRetries: config?.retry?.maxRetries ?? 3,`);
    lines.push(`      retryDelay: config?.retry?.retryDelay ?? 1000,`);
    lines.push(`      backoffMultiplier: config?.retry?.backoffMultiplier ?? 2,`);
    lines.push(`      retryableStatusCodes: config?.retry?.retryableStatusCodes ?? [408, 429, 500, 502, 503, 504],`);
    lines.push(`      onRetry: config?.retry?.onRetry,`);
    lines.push(`    };`);
  }

  if (options.useAxios) {
    lines.push(`    this.axios = axios.create({`);
    lines.push(`      baseURL: this.baseUrl,`);
    if (options.includeCredentials) {
      lines.push(`      withCredentials: true,`);
    }
    lines.push(`    });`);
  }

  lines.push(`  }`);
  lines.push(``);

  // Helper methods
  lines.push(`  private buildUrl(path: string): string {`);
  lines.push(`    return \`\${this.baseUrl.replace(/\\/$/, '')}\${path}\`;`);
  lines.push(`  }`);
  lines.push(``);

  if (includeCache) {
    lines.push(generateCacheHelpers());
  }

  if (includeRetry) {
    lines.push(generateRetryHelpers(options.useAxios));
  }

  // API methods with retry and cache
  lines.push(generateEnhancedClientMethods(spec, options, includeRetry, includeCache));

  lines.push(`}`);

  return lines.join('\n');
}

// Generate cache helper methods
function generateCacheHelpers(): string {
  return `  // Cache helper methods
  private getCacheKey(url: string, params?: any): string {
    if (this.cacheConfig.cacheKeyGenerator) {
      return this.cacheConfig.cacheKeyGenerator(url, params);
    }
    const queryString = params ? JSON.stringify(params) : '';
    return \`\${url}?\${queryString}\`;
  }

  private getFromCache(key: string): unknown | null {
    if (!this.cacheConfig.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: unknown, ttl?: number): void {
    if (!this.cacheConfig.enabled) return;

    // Evict oldest entries if cache is too large
    if (this.cache.size >= (this.cacheConfig.maxSize ?? 100)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.cacheConfig.ttl ?? 60000,
    });
  }

  private clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  public invalidateCache(url?: string): void {
    if (url) {
      this.clearCache(url);
    } else {
      this.cache.clear();
    }
  }

`;
}

// Generate retry helper methods
function generateRetryHelpers(useAxios: boolean): string {
  if (useAxios) {
    return `  // Retry helper methods
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (
        attempt >= (this.retryConfig.maxRetries ?? 3) ||
        status !== undefined &&
        !(this.retryConfig.retryableStatusCodes ?? []).includes(status)
      ) {
        throw error;
      }

      // Call retry callback if provided
      if (this.retryConfig.onRetry) {
        this.retryConfig.onRetry(attempt, error as Error);
      }

      // Calculate delay with exponential backoff
      const delay = (this.retryConfig.retryDelay ?? 1000) *
                   Math.pow(this.retryConfig.backoffMultiplier ?? 2, attempt - 1);

      await new Promise(resolve => setTimeout(resolve, delay));

      return this.retryWithBackoff(fn, attempt + 1);
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnreset')
      );
    }
    return false;
  }

`;
  } else {
    return `  // Retry helper methods for fetch
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= (this.retryConfig.maxRetries ?? 3)) {
        throw error;
      }

      // Call retry callback if provided
      if (this.retryConfig.onRetry) {
        this.retryConfig.onRetry(attempt, error as Error);
      }

      // Calculate delay with exponential backoff
      const delay = (this.retryConfig.retryDelay ?? 1000) *
                   Math.pow(this.retryConfig.backoffMultiplier ?? 2, attempt - 1);

      await new Promise(resolve => setTimeout(resolve, delay));

      return this.retryWithBackoff(fn, attempt + 1);
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('fetch failed')
      );
    }
    return false;
  }

`;
  }
}

// Generate enhanced client methods with retry and cache
function generateEnhancedClientMethods(
  spec: OpenAPISpec,
  options: ClientOptions,
  includeRetry: boolean,
  includeCache: boolean
): string {
  const lines: string[] = [];

  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;

      const opId = operation.operationId || toMethodName(`${method}_${path}`);
      const methodName = toMethodName(opId);
      const description = operation.description || operation.summary || '';
      const httpMethod = method.toUpperCase();
      const isGetOrHead = httpMethod === 'GET' || httpMethod === 'HEAD';

      // Parse parameters
      const pathParams = (operation.parameters || []).filter((p: Parameter) => p.in === 'path');
      const queryParams = (operation.parameters || []).filter((p: Parameter) => p.in === 'query');
      const headerParams = (operation.parameters || []).filter((p: Parameter) => p.in === 'header');

      const hasPathParams = pathParams.length > 0;
      const hasQueryParams = queryParams.length > 0;
      const hasHeaderParams = headerParams.length > 0;

      // Build method signature
      lines.push(`/**`);
      if (description) lines.push(` * ${description}`);
      lines.push(` * @ HTTP ${httpMethod} ${path}`);
      if (isGetOrHead && includeCache) {
        lines.push(` * @cached Responses are cached based on URL and query parameters`);
      }
      if (includeRetry) {
        lines.push(` * @retry Failed requests are automatically retried with exponential backoff`);
      }
      lines.push(` */`);

      const hasBody = operation.requestBody;
      const params: string[] = [];

      if (hasPathParams) {
        pathParams.forEach((p: Parameter) => {
          const paramType = p.schema ? generateType(p.schema, `${capitalize(p.name)}Param`, new Set()) : 'string';
          params.push(`  ${p.name}: ${paramType};${p.required ? '' : '?'}`);
        });
      }

      if (hasQueryParams) {
        params.push(`  query?: {`);
        queryParams.forEach((p: Parameter) => {
          const paramType = p.schema ? generateType(p.schema, `${capitalize(p.name)}Query`, new Set()) : 'string';
          params.push(`    ${p.name}?: ${paramType};`);
        });
        params.push(`  };`);
      }

      if (hasHeaderParams) {
        params.push(`  headers?: {`);
        headerParams.forEach((p: Parameter) => {
          const paramType = p.schema ? generateType(p.schema, `${capitalize(p.name)}Header`, new Set()) : 'string';
          params.push(`    ${p.name}?: ${paramType};`);
        });
        params.push(`  };`);
      }

      if (hasBody) {
        const content = operation.requestBody.content || {};
        const jsonSchema = content['application/json']?.schema || content['*/*']?.schema || operation.requestBody.schema;
        if (jsonSchema) {
          const bodyType = generateType(jsonSchema, 'RequestBody', new Set());
          params.push(`  body: ${bodyType};`);
        } else {
          params.push(`  body: unknown;`);
        }
      }

      // Add cache/retry options
      params.push(`  options?: {`);
      params.push(`    signal?: AbortSignal;`);
      params.push(`    headers?: Record<string, string>;`);
      if (includeCache && isGetOrHead) {
        params.push(`    cache?: boolean | number; // false to disable, number for custom TTL`);
      }
      if (includeRetry) {
        params.push(`    retry?: boolean | Partial<RetryConfig>;`);
      }
      params.push(`  };`);

      // Build method
      let methodSig = `async ${methodName}(`;

      if (params.length > 0) {
        methodSig += `params: {\n${params.join('\n')}\n  }, `;
      }

      methodSig += `options?: { signal?: AbortSignal; headers?: Record<string, string>; ${includeCache && isGetOrHead ? 'cache?: boolean | number;' : ''} ${includeRetry ? 'retry?: boolean | Partial<RetryConfig>;' : ''} }`;

      // Determine response type
      const successResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['204'];
      let responseType = 'void';

      if (successResponse) {
        const content = (successResponse as Response).content;
        if (content?.['application/json']?.schema) {
          responseType = generateType(content['application/json'].schema, 'Response', new Set());
        } else if ((successResponse as Response).schema) {
          responseType = generateType((successResponse as Response).schema, 'Response', new Set());
        } else {
          responseType = 'unknown';
        }
      }

      methodSig += `): Promise<${responseType}>`;

      lines.push(methodSig + ' {');
      lines.push(`  const url = this.buildUrl('${path}'`);

      if (hasPathParams) {
        pathParams.forEach((p: Parameter) => {
          lines.push(`    .replace('{${p.name}}', encodeURIComponent(String(params.${p.name})))`);
        });
      }

      lines.push(`  );`);

      // Build query string
      if (hasQueryParams) {
        lines.push(`  const queryString = new URLSearchParams();`);
        lines.push(`  if (params.query) {`);
        queryParams.forEach((p: Parameter) => {
          lines.push(`    if (params.query.${p.name} !== undefined) {`);
          lines.push(`      queryString.append('${p.name}', String(params.query.${p.name}));`);
          lines.push(`    }`);
        });
        lines.push(`  }`);
        lines.push(`  const fullUrl = queryString.toString() ? \`\${url}?\${queryString}\` : url;`);
      } else {
        lines.push(`  const fullUrl = url;`);
      }

      // Build headers
      lines.push(`  const headers = {`);
      lines.push(`    'Content-Type': 'application/json',`);
      lines.push(`    ...this.defaultHeaders,`);
      lines.push(`    ...options?.headers,`);

      if (hasHeaderParams) {
        lines.push(`    ...(params.headers || {}),`);
      }

      lines.push(`  };`);

      // Check cache for GET requests
      if (includeCache && isGetOrHead) {
        lines.push(`  // Check cache`);
        lines.push(`  const cacheKey = this.getCacheKey(fullUrl, params.query);`);
        lines.push(`  const cached = this.getFromCache(cacheKey);`);
        lines.push(`  if (cached && options?.cache !== false) {`);
        lines.push(`    return cached as ${responseType};`);
        lines.push(`  }`);
        lines.push(``);
      }

      // Build request with retry logic
      const requestFn = `  const makeRequest = async (): Promise<${responseType}> => {
        ${options.useAxios ? generateAxiosRequest(httpMethod, hasBody, responseType) : generateFetchRequest(httpMethod, hasBody, responseType)}
      }`;

      lines.push(requestFn);

      // Build return statement with proper chaining for cache and retry
      if (includeCache && isGetOrHead) {
        // Cache is enabled - need to chain .then() to store result
        if (includeRetry) {
          lines.push(`  // Retry logic with exponential backoff`);
          lines.push(`  const shouldRetry = options?.retry !== false && (options?.retry === true || Object.keys(options?.retry ?? {}).length > 0);`);
          lines.push(`  const requestPromise = shouldRetry ? this.retryWithBackoff(makeRequest) : makeRequest();`);
          lines.push(`  return requestPromise`);
        } else {
          lines.push(`  return makeRequest()`);
        }
        // Chain .then() for cache storage
        lines.push(`    .then(data => {`);
        lines.push(`      if (options?.cache !== false) {`);
        lines.push(`        const ttl = typeof options?.cache === 'number' ? options.cache : undefined;`);
        lines.push(`        this.setCache(cacheKey, data, ttl);`);
        lines.push(`      }`);
        lines.push(`      return data;`);
        lines.push(`    });`);
      } else {
        // No caching - simpler return
        if (includeRetry) {
          lines.push(`  // Retry logic with exponential backoff`);
          lines.push(`  const shouldRetry = options?.retry !== false && (options?.retry === true || Object.keys(options?.retry ?? {}).length > 0);`);
          lines.push(`  if (shouldRetry) {`);
          lines.push(`    if (typeof options?.retry === 'object') {`);
          lines.push(`      this.retryConfig = { ...this.retryConfig, ...options.retry };`);
          lines.push(`    }`);
          lines.push(`    return this.retryWithBackoff(makeRequest);`);
          lines.push(`  }`);
        }
        lines.push(`  return makeRequest();`);
      }

      lines.push(`}`);
      lines.push(``);
    });
  });

  return lines.join('\n');
}

// Generate axios request code
function generateAxiosRequest(method: string, hasBody: boolean, responseType: string): string {
  const lines: string[] = [];
  lines.push(`    const response = await this.axios.${method.toLowerCase()}(fullUrl, {`);
  if (hasBody) {
    lines.push(`      data: params.body,`);
  }
  lines.push(`      headers,`);
  lines.push(`      signal: options?.signal,`);
  lines.push(`    });`);
  lines.push(`    return response.data as ${responseType};`);
  return lines.join('\n        ');
}

// Generate fetch request code
function generateFetchRequest(method: string, hasBody: boolean, responseType: string): string {
  const lines: string[] = [];
  lines.push(`    const response = await fetch(fullUrl, {`);
  lines.push(`      method: '${method}',`);
  if (hasBody) {
    lines.push(`      body: JSON.stringify(params.body),`);
  }
  lines.push(`      headers,`);
  lines.push(`      signal: options?.signal,`);
  lines.push(`    });`);

  lines.push(`    if (!response.ok) {`);
  lines.push(`      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);`);
  lines.push(`    }`);

  if (responseType === 'void') {
    lines.push(`    return;`);
  } else if (responseType === 'unknown') {
    lines.push(`    return await response.json();`);
  } else {
    lines.push(`    return await response.json() as ${responseType};`);
  }

  return lines.join('\n        ');
}

// Convert to camelCase
export function toCamelCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (l, i) => i === 0 ? l.toLowerCase() : l.toUpperCase())
    .replace(/\s/g, '');
}

// Generate enum types for schemas with enums
export function generateEnums(spec: OpenAPISpec): string {
  const lines: string[] = [];
  const schemas = spec.components?.schemas || spec.definitions || {};

  Object.entries(schemas).forEach(([name, schema]) => {
    if (schema.enum) {
      lines.push(`export enum ${name} {`);
      schema.enum.forEach(value => {
        const key = typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '_') : `VALUE_${value}`;
        lines.push(`  ${key} = ${typeof value === 'string' ? `'${value}'` : value},`);
      });
      lines.push(`}`);
      lines.push(``);
    }
  });

  return lines.join('\n');
}

// Generate API client from OpenAPI spec file
export async function generateClientFromSpecFile(
  specPath: string,
  outputPath: string,
  options: Partial<ClientOptions> = {}
): Promise<void> {
  const specContent = await fs.readFile(specPath, 'utf-8');
  const spec: OpenAPISpec = JSON.parse(specContent);

  const fullOptions: ClientOptions = {
    spec,
    clientName: options.clientName,
    baseUrl: options.baseUrl,
    useAxios: options.useAxios ?? true,
    includeCredentials: options.includeCredentials ?? false,
    includeRetry: options.includeRetry ?? false,
    includeCache: options.includeCache ?? false,
    exportType: options.exportType || 'default',
    emitDeprecatedMethods: options.emitDeprecatedMethods ?? false,
    useEnumTypes: options.useEnumTypes ?? false,
  };

  const clientCode = generateClient(spec, fullOptions);

  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, clientCode, 'utf-8');
}

// Generate React Query hooks for the API client
export function generateReactQueryHooks(spec: OpenAPISpec, clientName: string): string {
  const lines: string[] = [];

  lines.push(`import { useMutation, useQuery, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';`);
  lines.push(`import { ${clientName} } from './client';`);
  lines.push('');

  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;
      if (method.toLowerCase() === 'get' || method.toLowerCase() === 'head') {
        // Generate query hooks
        const opId = operation.operationId || toMethodName(`${method}_${path}`);
        const hookName = `use${toMethodName(opId)}`;
        lines.push(`export function ${hookName}(`);
        lines.push(`  client: ${clientName},`);
        lines.push(`  params: any,`);
        lines.push(`  options?: Omit<UseQueryOptions<unknown>, 'queryKey' | 'queryFn'>`);
        lines.push(`) {`);
        lines.push(`  return useQuery({`);
        lines.push(`    queryKey: ['${opId}', params],`);
        lines.push(`    queryFn: () => client.${toMethodName(opId)}(params),`);
        lines.push(`    ...options,`);
        lines.push(`  });`);
        lines.push(`}`);
        lines.push(``);
      } else {
        // Generate mutation hooks
        const opId = operation.operationId || toMethodName(`${method}_${path}`);
        const hookName = `use${toMethodName(opId)}Mutation`;
        lines.push(`export function ${hookName}(`);
        lines.push(`  client: ${clientName},`);
        lines.push(`  options?: Omit<UseMutationOptions<unknown, unknown, any>, 'mutationFn'>`);
        lines.push(`) {`);
        lines.push(`  return useMutation({`);
        lines.push(`    mutationFn: (params) => client.${toMethodName(opId)}(params),`);
        lines.push(`    ...options,`);
        lines.push(`  });`);
        lines.push(`}`);
        lines.push(``);
      }
    });
  });

  return lines.join('\n');
}

// List available operations from spec
export function listOperations(spec: OpenAPISpec): Array<{
  operationId: string;
  method: string;
  path: string;
  description: string;
}> {
  const operations: Array<{ operationId: string; method: string; path: string; description: string }> = [];

  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;

      operations.push({
        operationId: operation.operationId || toMethodName(`${method}_${path}`),
        method: method.toUpperCase(),
        path,
        description: operation.description || operation.summary || '',
      });
    });
  });

  return operations;
}

// Validate OpenAPI spec
export function validateSpec(spec: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!spec || typeof spec !== 'object') {
    errors.push('Spec must be an object');
    return { valid: false, errors };
  }

  const s = spec as OpenAPISpec;

  if (!s.openapi && !s.swagger) {
    errors.push('Spec must have either "openapi" or "swagger" field');
  }

  if (!s.info || typeof s.info !== 'object') {
    errors.push('Spec must have an "info" object');
  } else {
    if (!s.info.title) {
      errors.push('Spec must have "info.title"');
    }
    if (!s.info.version) {
      errors.push('Spec must have "info.version"');
    }
  }

  if (!s.paths || typeof s.paths !== 'object') {
    errors.push('Spec must have "paths" object');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ==================== FRAMEWORK-SPECIFIC GENERATORS ====================

/**
 * Generate Vue composables with @tanstack/vue-query support
 */
export function generateVueComposables(spec: OpenAPISpec, clientName: string): string {
  const lines: string[] = [];

  lines.push(`import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from '@tanstack/vue-query';`);
  lines.push(`import { ${clientName} } from './client';`);
  lines.push(`import { computed, type Ref } from 'vue';`);
  lines.push('');
  lines.push(`// Auto-generated Vue composables from OpenAPI specification`);
  lines.push(`// ${spec.info.title} v${spec.info.version}`);
  lines.push('');

  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;

      const opId = operation.operationId || toMethodName(`${method}_${path}`);
      const summary = operation.summary || operation.description || opId;

      if (method.toLowerCase() === 'get' || method.toLowerCase() === 'head') {
        const hookName = `use${toMethodName(opId)}`;
        lines.push(`/**`);
        lines.push(` * ${summary}`);
        lines.push(` * @method ${method.toUpperCase()} ${path}`);
        lines.push(` */`);
        lines.push(`export function ${hookName}(`);
        lines.push(`  client: Ref<${clientName}>,`);
        lines.push(`  params: any,`);
        lines.push(`  options?: Omit<UseQueryOptions<unknown>, 'queryKey' | 'queryFn'>`);
        lines.push(`) {`);
        lines.push(`  return useQuery({`);
        lines.push(`    queryKey: ['${opId}', params] as const,`);
        lines.push(`    queryFn: () => client.value.${toMethodName(opId)}(params),`);
        lines.push(`    ...options,`);
        lines.push(`  });`);
        lines.push(`}`);
        lines.push(``);
      } else {
        const hookName = `use${toMethodName(opId)}Mutation`;
        lines.push(`/**`);
        lines.push(` * ${summary}`);
        lines.push(` * @method ${method.toUpperCase()} ${path}`);
        lines.push(` */`);
        lines.push(`export function ${hookName}(`);
        lines.push(`  client: Ref<${clientName}>,`);
        lines.push(`  options?: Omit<UseMutationOptions<unknown, unknown, any>, 'mutationFn'>`);
        lines.push(`) {`);
        lines.push(`  return useMutation({`);
        lines.push(`    mutationFn: (params: any) => client.value.${toMethodName(opId)}(params),`);
        lines.push(`    ...options,`);
        lines.push(`  });`);
        lines.push(`}`);
        lines.push(``);
      }
    });
  });

  return lines.join('\n');
}

/**
 * Generate Pinia stores for API state management
 */
export function generatePiniaStores(spec: OpenAPISpec, clientName: string): string {
  const lines: string[] = [];

  lines.push(`import { defineStore } from 'pinia';`);
  lines.push(`import { ref, computed } from 'vue';`);
  lines.push(`import { ${clientName} } from './client';`);
  lines.push('');
  lines.push(`// Auto-generated Pinia stores from OpenAPI specification`);
  lines.push(`// ${spec.info.title} v${spec.info.version}`);
  lines.push('');

  const storeName = spec.info.title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const storeClassName = `use${spec.info.title.replace(/[^a-zA-Z0-9]/g, '')}Store`;

  lines.push(`export const ${storeClassName} = defineStore('${storeName}', () => {`);
  lines.push(`  const client = new ${clientName}();`);
  lines.push(`  const loading = ref(false);`);
  lines.push(`  const error = ref<string | null>(null);`);

  // Add state properties for each GET operation
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;
      if (method.toLowerCase() === 'get') {
        const opId = operation.operationId || toMethodName(`${method}_${path}`);
        lines.push(`  const ${opId}Data = ref<unknown>(null);`);
      }
    });
  });

  lines.push('');
  lines.push(`  // Actions`);

  // Add actions for each operation
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;

      const opId = operation.operationId || toMethodName(`${method}_${path}`);
      const methodName = toMethodName(opId);

      if (method.toLowerCase() === 'get') {
        lines.push(`  async function ${methodName}(params?: any) {`);
        lines.push(`    loading.value = true;`);
        lines.push(`    error.value = null;`);
        lines.push(`    try {`);
        lines.push(`      ${opId}Data.value = await client.${methodName}(params);`);
        lines.push(`      return ${opId}Data.value;`);
        lines.push(`    } catch (e) {`);
        lines.push(`      error.value = e instanceof Error ? e.message : 'Unknown error';`);
        lines.push(`      throw e;`);
        lines.push(`    } finally {`);
        lines.push(`      loading.value = false;`);
        lines.push(`    }`);
        lines.push(`  }`);
      } else {
        lines.push(`  async function ${methodName}(params: any) {`);
        lines.push(`    loading.value = true;`);
        lines.push(`    error.value = null;`);
        lines.push(`    try {`);
        lines.push(`      const result = await client.${methodName}(params);`);
        lines.push(`      return result;`);
        lines.push(`    } catch (e) {`);
        lines.push(`      error.value = e instanceof Error ? e.message : 'Unknown error';`);
        lines.push(`      throw e;`);
        lines.push(`    } finally {`);
        lines.push(`      loading.value = false;`);
        lines.push(`    }`);
        lines.push(`  }`);
      }
      lines.push(``);
    });
  });

  lines.push(`  return {`);
  lines.push(`    loading,`);
  lines.push(`    error,`);

  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;
      if (method.toLowerCase() === 'get') {
        const opId = operation.operationId || toMethodName(`${method}_${path}`);
        lines.push(`    ${opId}Data,`);
        lines.push(`    ${toMethodName(opId)},`);
      } else {
        lines.push(`    ${toMethodName(operation.operationId || toMethodName(`${method}_${path}`))},`);
      }
    });
  });

  lines.push(`  };`);
  lines.push(`});`);

  return lines.join('\n');
}

/**
 * Generate Angular service with HttpClient
 */
export function generateAngularService(spec: OpenAPISpec, serviceName: string): string {
  const lines: string[] = [];

  lines.push(`import { Injectable } from '@angular/core';`);
  lines.push(`import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';`);
  lines.push(`import { Observable, throwError } from 'rxjs';`);
  lines.push(`import { catchError, map } from 'rxjs/operators';`);
  lines.push('');
  lines.push(`// Auto-generated Angular service from OpenAPI specification`);
  lines.push(`// ${spec.info.title} v${spec.info.version}`);
  lines.push('');

  const baseUrl = `'${spec.servers?.[0]?.url || 'https://api.example.com'}'`;

  lines.push(`@Injectable({`);
  lines.push(`  providedIn: 'root'`);
  lines.push(`})`);
  lines.push(`export class ${serviceName} {`);
  lines.push(`  private baseUrl = ${baseUrl};`);
  lines.push(`  private defaultHeaders = new HttpHeaders();`);
  lines.push('');
  lines.push(`  constructor(private http: HttpClient) {}`);
  lines.push('');

  // Add methods for each operation
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;

      const opId = operation.operationId || toMethodName(`${method}_${path}`);
      const methodName = toMethodName(opId);
      const summary = operation.summary || operation.description || '';

      lines.push(`  /**`);
      lines.push(`   * ${summary}`);
      lines.push(`   * ${method.toUpperCase()} ${path}`);
      lines.push(`   */`);
      lines.push(`  ${methodName}(`);

      // Add parameters
      const params = operation.parameters || [];
      if (operation.requestBody) {
        lines.push(`    body: any,`);
      }
      if (params.length > 0) {
        params.forEach((param, i) => {
          const typeName = getParamType(param);
          const optional = !param.required ? '?' : '';
          lines.push(`    ${param.name}${optional}: ${typeName},`);
        });
      }
      lines.push(`    options?: {`);
      lines.push(`      headers?: HttpHeaders;`);
      lines.push(`      observe?: 'body' | 'events' | 'response';`);
      lines.push(`      params?: HttpParams;`);
      lines.push(`      reportProgress?: boolean;`);
      lines.push(`      responseType?: 'json' | 'blob' | 'text';`);
      lines.push(`      withCredentials?: boolean;`);
      lines.push(`    }`);
      lines.push(`  ): Observable<any> {`);

      // Build request
      lines.push(`    let httpHeaders = this.defaultHeaders;`);
      lines.push(`    if (options?.headers) {`);
      lines.push(`      httpHeaders = options.headers;`);
      lines.push(`    }`);

      lines.push(`    let httpParams = new HttpParams();`);
      lines.push(`    if (options?.params) {`);
      lines.push(`      httpParams = options.params;`);
      lines.push(`    }`);

      // Add query parameters
      params.filter(p => p.in === 'query').forEach(param => {
        if (!param.required) {
          lines.push(`    if (${param.name} !== undefined) {`);
          lines.push(`      httpParams = httpParams.set('${param.name}', ${param.name});`);
          lines.push(`    }`);
        } else {
          lines.push(`    httpParams = httpParams.set('${param.name}', ${param.name});`);
        }
      });

      lines.push(`    const requestOptions = {`);
      lines.push(`      headers: httpHeaders,`);
      lines.push(`      params: httpParams,`);
      lines.push(`      observe: options?.observe || 'body',`);
      lines.push(`      reportProgress: options?.reportProgress || false,`);
      lines.push(`      responseType: options?.responseType || 'json',`);
      lines.push(`      withCredentials: options?.withCredentials || false,`);
      lines.push(`    };`);

      // Make HTTP request
      const httpMethod = method.toLowerCase();
      const requestPath = path.replace(/\{([^}]+)\}/g, '${$1}');

      if (['post', 'put', 'patch'].includes(httpMethod)) {
        lines.push(`    return this.http.${httpMethod}<any>(\`\${this.baseUrl}${requestPath}\`, body, requestOptions).pipe(`);
      } else if (httpMethod === 'delete') {
        lines.push(`    return this.http.delete<any>(\`\${this.baseUrl}${requestPath}\`, requestOptions).pipe(`);
      } else {
        lines.push(`    return this.http.get<any>(\`\${this.baseUrl}${requestPath}\`, requestOptions).pipe(`);
      }

      lines.push(`      catchError((error) => {`);
      lines.push(`        console.error(\`Error in ${methodName}:\`, error);`);
      lines.push(`        return throwError(() => error);`);
      lines.push(`      })`);
      lines.push(`    );`);
      lines.push(`  }`);
      lines.push(``);
    });
  });

  lines.push(`}`);

  return lines.join('\n');
}

/**
 * Get TypeScript type for parameter
 */
function getParamType(param: Parameter): string {
  if (param.schema) {
    return generateType(param.schema, param.name);
  }
  if (param.type) {
    const typeMap: Record<string, string> = {
      string: 'string',
      number: 'number',
      integer: 'number',
      boolean: 'boolean',
      array: 'any[]',
    };
    return typeMap[param.type] || 'any';
  }
  return 'any';
}

/**
 * Generate Svelte stores for API state management
 */
export function generateSvelteStores(spec: OpenAPISpec, clientName: string): string {
  const lines: string[] = [];

  lines.push(`import { writable, derived } from 'svelte/store';`);
  lines.push(`import { ${clientName} } from './client';`);
  lines.push('');
  lines.push(`// Auto-generated Svelte stores from OpenAPI specification`);
  lines.push(`// ${spec.info.title} v${spec.info.version}`);
  lines.push('');

  const clientVar = clientName.charAt(0).toLowerCase() + clientName.slice(1);
  lines.push(`const ${clientVar} = new ${clientName}();`);
  lines.push('');

  // Create loading and error stores
  lines.push(`export const loading = writable(false);`);
  lines.push(`export const error = writable<string | null>(null);`);
  lines.push('');

  // Create stores for each GET operation
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;

      const opId = operation.operationId || toMethodName(`${method}_${path}`);
      const methodName = toMethodName(opId);

      if (method.toLowerCase() === 'get') {
        lines.push(`// ${operation.summary || operation.description || `${method.toUpperCase()} ${path}`}`);
        lines.push(`export const ${opId} = writable<unknown>(null);`);
        lines.push(`export const ${opId}Loading = derived(loading, ($loading) => $loading);`);
        lines.push('');
        lines.push(`export async function fetch${methodName}(params?: any) {`);
        lines.push(`  loading.set(true);`);
        lines.push(`  error.set(null);`);
        lines.push(`  try {`);
        lines.push(`    const result = await ${clientVar}.${methodName}(params);`);
        lines.push(`    ${opId}.set(result);`);
        lines.push(`    return result;`);
        lines.push(`  } catch (e) {`);
        lines.push(`    error.set(e instanceof Error ? e.message : 'Unknown error');`);
        lines.push(`    throw e;`);
        lines.push(`  } finally {`);
        lines.push(`    loading.set(false);`);
        lines.push(`  }`);
        lines.push(`}`);
        lines.push('');
      } else {
        lines.push(`// ${operation.summary || operation.description || `${method.toUpperCase()} ${path}`}`);
        lines.push(`export async function ${methodName}(data: any) {`);
        lines.push(`  loading.set(true);`);
        lines.push(`  error.set(null);`);
        lines.push(`  try {`);
        lines.push(`    const result = await ${clientVar}.${methodName}(data);`);
        lines.push(`    return result;`);
        lines.push(`  } catch (e) {`);
        lines.push(`    error.set(e instanceof Error ? e.message : 'Unknown error');`);
        lines.push(`    throw e;`);
        lines.push(`  } finally {`);
        lines.push(`    loading.set(false);`);
        lines.push(`  }`);
        lines.push(`}`);
        lines.push('');
      }
    });
  });

  return lines.join('\n');
}

/**
 * Generate SvelteKit SDK with load functions and actions
 */
export function generateSvelteKitSdk(spec: OpenAPISpec, clientName: string): string {
  const lines: string[] = [];

  lines.push(`import { ${clientName} } from './client';`);
  lines.push('');
  lines.push(`// Auto-generated SvelteKit SDK from OpenAPI specification`);
  lines.push(`// ${spec.info.title} v${spec.info.version}`);
  lines.push('');

  const clientVar = clientName.charAt(0).toLowerCase() + clientName.slice(1);
  const baseUrlValue = spec.servers?.[0]?.url || 'http://localhost:3000';

  lines.push(`const ${clientVar} = new ${clientName}({ baseUrl: '${baseUrlValue}' });`);
  lines.push('');

  // Generate load functions for GET operations
  lines.push(`// Load functions for SvelteKit pages`);
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;
      if (method.toLowerCase() !== 'get') return;

      const opId = operation.operationId || toMethodName(`${method}_${path}`);
      const loadFnName = `load${toMethodName(opId)}`;

      lines.push(`/**`);
      lines.push(` * Load function for ${operation.summary || operation.description || path}`);
      lines.push(` * Usage: +page.ts or +layout.ts`);
      lines.push(` */`);
      lines.push(`export async function ${loadFnName}(`);
      lines.push(`  { fetch, params }: { fetch: typeof globalThis.fetch; params: Record<string, string> }`);
      lines.push(`) {`);
      lines.push(`  const data = await ${clientVar}.${toMethodName(opId)}(params);`);
      lines.push(`  return {`);
      lines.push(`    ${opId}: data,`);
      lines.push(`  };`);
      lines.push(`}`);
      lines.push('');
    });
  });

  // Generate actions for mutations
  lines.push(`// Actions for form submissions`);
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;
      if (['get', 'head', 'options'].includes(method.toLowerCase())) return;

      const opId = operation.operationId || toMethodName(`${method}_${path}`);
      const actionFnName = `${toMethodName(opId)}Action`;

      lines.push(`/**`);
      lines.push(` * Action for ${operation.summary || operation.description || path}`);
      lines.push(` * Usage: +page.server.ts or form actions`);
      lines.push(` */`);
      lines.push(`export async function ${actionFnName}(data: any) {`);
      lines.push(`  return await ${clientVar}.${toMethodName(opId)}(data);`);
      lines.push(`}`);
      lines.push('');
    });
  });

  return lines.join('\n');
}

// ==================== MOCK SERVER GENERATION ====================

/**
 * Generate a mock server with Express.js from OpenAPI specification
 * Returns realistic mock data based on schema types
 */
export function generateMockServer(spec: OpenAPISpec, options: ClientOptions = {}): string {
  const lines: string[] = [];
  const port = options.port || 3001;

  // Add imports
  lines.push(`import express, { Request, Response } from 'express';`);
  lines.push(`import cors from 'cors';`);
  lines.push(``);
  lines.push(`// Auto-generated Mock Server from OpenAPI specification`);
  lines.push(`// ${spec.info.title} v${spec.info.version}`);
  lines.push(``);
  lines.push(`const app = express();`);
  lines.push(`const PORT = ${port};`);
  lines.push(``);
  lines.push(`app.use(cors());`);
  lines.push(`app.use(express.json());`);
  lines.push(``);

  // Add in-memory data store
  lines.push(`// In-memory data store`);
  lines.push(`const dataStore: Record<string, any[]> = {};`);
  lines.push(``);

  // Generate routes for each path
  lines.push(`// API Routes`);
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;

      const httpMethod = method.toUpperCase();
      const operationId = operation.operationId || toMethodName(method + '_' + path);

      lines.push(``);
      lines.push(`/**`);
      if (operation.summary) lines.push(` * ${operation.summary}`);
      if (operation.description) lines.push(` * ${operation.description}`);
      lines.push(` * ${httpMethod} ${path}`);
      lines.push(` */`);
      lines.push(`app.` + method.toLowerCase() + `('${path}', async (req: Request, res: Response) => {`);
      lines.push(`  console.log('[${operationId}] ${httpMethod} ${path}', req.query, req.body);`);
      lines.push(``);

      // Generate response based on operation
      const successResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['204'];
      const responseSchema = successResponse?.['content']?.['application/json']?.schema
        || (successResponse as Response)?.schema;

      if (httpMethod === 'GET' && path.includes('{')) {
        // Single resource by ID
        const resourcePath = path.split('{')[0].replace(/\/$/, '');
        lines.push(`  const { id } = req.params;`);
        lines.push(`  const collection = dataStore['${resourcePath}'] || [];`);
        lines.push(`  const item = collection.find((i: any) => i.id === id);`);
        lines.push(`  if (!item) {`);
        lines.push(`    return res.status(404).json({ error: 'Resource not found' });`);
        lines.push(`  }`);
        lines.push(`  res.json(item);`);
      } else if (httpMethod === 'GET') {
        // List resources
        lines.push(`  const collection = dataStore['${path}'] || [];`);
        lines.push(`  const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;`);
        lines.push(`  const result = limit ? collection.slice(0, limit) : collection;`);
        lines.push(`  res.json(result);`);
      } else if (httpMethod === 'POST') {
        // Create resource
        lines.push(`  const newItem = {`);
        lines.push(`    id: Date.now().toString(),`);
        lines.push(`    ...req.body,`);
        lines.push(`    createdAt: new Date().toISOString(),`);
        lines.push(`  };`);
        lines.push(`  const collection = dataStore['${path}'] || [];`);
        lines.push(`  collection.push(newItem);`);
        lines.push(`  dataStore['${path}'] = collection;`);
        lines.push(`  res.status(201).json(newItem);`);
      } else if (httpMethod === 'PUT' || httpMethod === 'PATCH') {
        // Update resource
        const resourcePath = path.replace(/\/{[^}]+}$/, '');
        lines.push(`  const { id } = req.params;`);
        lines.push(`  const collection = dataStore['${resourcePath}'] || [];`);
        lines.push(`  const index = collection.findIndex((i: any) => i.id === id);`);
        lines.push(`  if (index === -1) {`);
        lines.push(`    return res.status(404).json({ error: 'Resource not found' });`);
        lines.push(`  }`);
        lines.push(`  collection[index] = { ...collection[index], ...req.body };`);
        lines.push(`  res.json(collection[index]);`);
      } else if (httpMethod === 'DELETE') {
        // Delete resource
        const resourcePath = path.replace(/\/{[^}]+}$/, '');
        lines.push(`  const { id } = req.params;`);
        lines.push(`  const collection = dataStore['${resourcePath}'] || [];`);
        lines.push(`  const index = collection.findIndex((i: any) => i.id === id);`);
        lines.push(`  if (index === -1) {`);
        lines.push(`    return res.status(404).json({ error: 'Resource not found' });`);
        lines.push(`  }`);
        lines.push(`  collection.splice(index, 1);`);
        lines.push(`  res.status(204).send();`);
      } else {
        lines.push(`  res.json({ message: '${operationId}' });`);
      }

      lines.push(`});`);
    });
  });

  lines.push(``);
  lines.push(`// Health check`);
  lines.push(`app.get('/health', (req: Request, res: Response) => {`);
  lines.push(`  res.json({ status: 'ok', timestamp: new Date().toISOString() });`);
  lines.push(`});`);
  lines.push(``);
  lines.push(`// Initialize sample data`);
  lines.push(generateSampleDataInit(spec));
  lines.push(``);
  lines.push(`// Start server`);
  lines.push(`app.listen(PORT, () => {`);
  lines.push(`  console.log('Mock server running at http://localhost:' + PORT);`);
  lines.push(`  console.log('Available routes:');`);
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;
      lines.push(`  console.log('  ` + method.toUpperCase().padEnd(7) + ` ${path}');`);
    });
  });
  lines.push(`});`);
  lines.push(``);

  return lines.join('\n');
}

/**
 * Generate mock data from schema
 */
function generateMockDataFromSchema(schema: Schema, depth = 0): string {
  if (depth > 3) return 'null';

  const type = schema.type || 'string';
  const enumValues = schema.enum;

  if (enumValues && enumValues.length > 0) {
    return '\'' + enumValues[0] + '\'';
  }

  switch (type) {
    case 'string':
      if (schema.format === 'date-time') return 'new Date().toISOString()';
      if (schema.format === 'date') return 'new Date().toISOString().split(\'T\')[0]';
      if (schema.format === 'email') return '\'user@example.com\'';
      if (schema.format === 'uri') return '\'https://example.com\'';
      if (schema.format === 'uuid') return '\'c9a6e8f0-1b3d-4e5f-6a7b-8c9d0e1f2a3b\'';
      if (schema.minLength !== undefined || schema.maxLength !== undefined) {
        const len = schema.minLength || schema.maxLength || 10;
        return '\'' + 'x'.repeat(Math.min(len, 20)) + '\'';
      }
      return '\'sample string\'';
    case 'number':
    case 'integer':
      if (schema.minimum !== undefined && schema.maximum !== undefined) {
        return String((schema.minimum + schema.maximum) / 2);
      }
      if (schema.minimum !== undefined) return String(schema.minimum);
      if (schema.maximum !== undefined) return String(schema.maximum);
      if (type === 'integer') return '42';
      return '3.14';
    case 'boolean':
      return 'true';
    case 'array':
      if (schema.items) {
        const itemValue = generateMockDataFromSchema(schema.items, depth + 1);
        return '[' + itemValue + ', ' + itemValue + ']';
      }
      return '[]';
    case 'object':
      if (schema.properties) {
        const props: string[] = [];
        Object.entries(schema.properties).forEach(([key, propSchema]: [string, Schema]) => {
          const value = generateMockDataFromSchema(propSchema, depth + 1);
          props.push(key + ': ' + value);
        });
        return '{ ' + props.join(', ') + ' }';
      }
      return '{}';
    default:
      return 'null';
  }
}

/**
 * Generate a function to create mock data for a schema
 */
function generateMockDataGenerator(name: string, schema: Schema): string {
  const lines: string[] = [];
  const functionName = 'createMock' + toCamelCase(name);

  lines.push('function ' + functionName + '(overrides: Partial<any> = {}): any {');
  lines.push('  return {');

  if (schema.properties) {
    Object.entries(schema.properties).forEach(([key, propSchema]: [string, Schema]) => {
      const value = generateMockDataFromSchema(propSchema);
      lines.push('    ' + key + ': ' + value + ',');
    });
  } else {
    lines.push('    id: Date.now().toString(),');
    lines.push('    name: \'Sample ' + name + '\',');
  }

  lines.push('    ...overrides,');
  lines.push('  };');
  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate sample data initialization code
 */
function generateSampleDataInit(spec: OpenAPISpec): string {
  const lines: string[] = [];

  lines.push('function initializeSampleData() {');
  lines.push('  // Initialize sample data for GET endpoints');
  lines.push('');

  // Find collection paths (e.g., /users, /products)
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    const hasGet = pathItem.get;
    const hasIdParam = path.includes('{');

    // Only generate sample data for list endpoints without path parameters
    if (hasGet && !hasIdParam) {
      const collectionName = path.replace(/^\//, '').replace(/\/$/, '') || 'root';
      lines.push('  dataStore[\'' + path + '\'] = [');

      // Get schema from response to generate proper mock data
      const getOp = pathItem.get;
      const successResponse = getOp?.responses?.['200'] || getOp?.responses?.['201'];
      const responseSchema = successResponse?.['content']?.['application/json']?.schema
        || successResponse?.schema;

      if (responseSchema?.type === 'array' && responseSchema.items) {
        // Generate 3 sample items
        for (let i = 1; i <= 3; i++) {
          const itemData = generateMockDataFromSchema(responseSchema.items);
          lines.push('    { id: \'' + i + '\', ' + itemData.substring(1, itemData.length - 1) + ' },');
        }
      } else {
        // Generic sample items
        lines.push('    { id: \'1\', name: \'Sample 1\' },');
        lines.push('    { id: \'2\', name: \'Sample 2\' },');
        lines.push('    { id: \'3\', name: \'Sample 3\' },');
      }

      lines.push('  ];');
      lines.push('');
    }
  });

  lines.push('}');
  lines.push('');
  lines.push('initializeSampleData();');

  return lines.join('\n');
}
