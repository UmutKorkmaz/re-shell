import { EventEmitter } from 'events';
import chalk from 'chalk';
import { ValidationError } from './error-handler';
import { PluginCommandContext, PluginCommandMiddleware } from './plugin-command-registry';

// Middleware types
export enum MiddlewareType {
  PRE_VALIDATION = 'pre-validation',
  VALIDATION = 'validation',
  PRE_EXECUTION = 'pre-execution',
  POST_EXECUTION = 'post-execution',
  ERROR_HANDLER = 'error-handler',
  LOGGER = 'logger',
  RATE_LIMITER = 'rate-limiter',
  CACHE = 'cache',
  TRANSFORM = 'transform',
  AUTHORIZATION = 'authorization'
}

// Middleware registration
export interface MiddlewareRegistration {
  id: string;
  pluginName: string;
  type: MiddlewareType;
  priority: number;
  handler: PluginCommandMiddleware;
  options?: MiddlewareOptions;
  isActive: boolean;
  appliesTo?: MiddlewareFilter;
  metadata?: Record<string, any>;
}

// Middleware options
export interface MiddlewareOptions {
  timeout?: number;
  skipOnError?: boolean;
  runAsync?: boolean;
  cache?: {
    enabled: boolean;
    ttl: number;
    key?: (args: any, options: any) => string;
  };
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
    skipFailedRequests?: boolean;
  };
}

// Middleware filter for selective application
export interface MiddlewareFilter {
  commands?: string[];
  plugins?: string[];
  categories?: string[];
  patterns?: RegExp[];
  custom?: (context: PluginCommandContext) => boolean;
}

// Middleware execution result
export interface MiddlewareResult {
  success: boolean;
  duration: number;
  error?: Error;
  data?: any;
  modified?: {
    args?: Record<string, any>;
    options?: Record<string, any>;
  };
  skipRemaining?: boolean;
}

// Built-in middleware factory functions
export interface BuiltinMiddleware {
  validation: (schema: any) => PluginCommandMiddleware;
  authorization: (permissions: string[]) => PluginCommandMiddleware;
  rateLimit: (options: { maxRequests: number; windowMs: number }) => PluginCommandMiddleware;
  cache: (options: { ttl: number; key?: (args: any, options: any) => string }) => PluginCommandMiddleware;
  logger: (options?: { level: string; format?: string }) => PluginCommandMiddleware;
  transform: (transformers: { args?: (args: any) => any; options?: (options: any) => any }) => PluginCommandMiddleware;
  errorHandler: (handler: (error: Error, context: PluginCommandContext) => void) => PluginCommandMiddleware;
  timing: () => PluginCommandMiddleware;
}

// Middleware chain manager
export class MiddlewareChainManager extends EventEmitter {
  private middlewares: Map<string, MiddlewareRegistration> = new Map();
  private typeChains: Map<MiddlewareType, string[]> = new Map();
  private commandMiddleware: Map<string, string[]> = new Map();
  private cache: Map<string, { data: any; expires: number }> = new Map();
  private rateLimiters: Map<string, Map<string, number[]>> = new Map();

  constructor() {
    super();
    this.initializeTypeChains();
  }

  // Initialize middleware type chains
  private initializeTypeChains(): void {
    Object.values(MiddlewareType).forEach(type => {
      this.typeChains.set(type, []);
    });
  }

  // Register middleware
  registerMiddleware(
    pluginName: string,
    type: MiddlewareType,
    handler: PluginCommandMiddleware,
    options?: {
      priority?: number;
      options?: MiddlewareOptions;
      appliesTo?: MiddlewareFilter;
      metadata?: Record<string, any>;
    }
  ): string {
    const id = this.generateMiddlewareId(pluginName, type);
    
    const registration: MiddlewareRegistration = {
      id,
      pluginName,
      type,
      priority: options?.priority || 0,
      handler,
      options: options?.options,
      isActive: true,
      appliesTo: options?.appliesTo,
      metadata: options?.metadata
    };

    this.middlewares.set(id, registration);
    this.updateTypeChain(type);

    this.emit('middleware-registered', { id, pluginName, type });
    return id;
  }

  // Unregister middleware
  unregisterMiddleware(id: string): boolean {
    const middleware = this.middlewares.get(id);
    if (!middleware) {
      return false;
    }

    this.middlewares.delete(id);
    this.updateTypeChain(middleware.type);
    
    // Clean up command-specific registrations
    this.commandMiddleware.forEach((middlewareIds, commandId) => {
      const index = middlewareIds.indexOf(id);
      if (index !== -1) {
        middlewareIds.splice(index, 1);
      }
    });

    this.emit('middleware-unregistered', { id });
    return true;
  }

  // Register middleware for specific command
  registerCommandMiddleware(commandId: string, middlewareId: string): void {
    if (!this.commandMiddleware.has(commandId)) {
      this.commandMiddleware.set(commandId, []);
    }
    
    const middlewareIds = this.commandMiddleware.get(commandId)!;
    if (!middlewareIds.includes(middlewareId)) {
      middlewareIds.push(middlewareId);
    }
  }

  // Execute middleware chain
  async executeChain(
    type: MiddlewareType,
    args: Record<string, any>,
    options: Record<string, any>,
    context: PluginCommandContext
  ): Promise<MiddlewareResult> {
    const startTime = Date.now();
    const chain = this.getMiddlewareChain(type, context);
    
    let currentArgs = { ...args };
    let currentOptions = { ...options };
    let skipRemaining = false;

    this.emit('chain-execution-started', { type, commandId: context.command.name });

    try {
      for (const middleware of chain) {
        if (skipRemaining) break;

        const result = await this.executeMiddleware(
          middleware,
          currentArgs,
          currentOptions,
          context
        );

        if (!result.success && !middleware.options?.skipOnError) {
          throw result.error || new Error('Middleware execution failed');
        }

        if (result.modified?.args) {
          currentArgs = { ...currentArgs, ...result.modified.args };
        }

        if (result.modified?.options) {
          currentOptions = { ...currentOptions, ...result.modified.options };
        }

        if (result.skipRemaining) {
          skipRemaining = true;
        }
      }

      const duration = Date.now() - startTime;
      this.emit('chain-execution-completed', { type, commandId: context.command.name, duration });

      return {
        success: true,
        duration,
        modified: {
          args: currentArgs,
          options: currentOptions
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.emit('chain-execution-failed', { type, commandId: context.command.name, error, duration });

      return {
        success: false,
        duration,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  // Execute single middleware
  private async executeMiddleware(
    middleware: MiddlewareRegistration,
    args: Record<string, any>,
    options: Record<string, any>,
    context: PluginCommandContext
  ): Promise<MiddlewareResult> {
    const startTime = Date.now();

    try {
      // Check cache if enabled
      if (middleware.options?.cache?.enabled) {
        const cacheKey = this.getCacheKey(middleware, args, options);
        const cached = this.getFromCache(cacheKey);
        if (cached !== undefined) {
          this.emit('middleware-cache-hit', { id: middleware.id, cacheKey });
          return {
            success: true,
            duration: Date.now() - startTime,
            data: cached
          };
        }
      }

      // Check rate limit if enabled
      if (middleware.options?.rateLimit) {
        const rateLimitKey = this.getRateLimitKey(middleware, context);
        if (!this.checkRateLimit(middleware, rateLimitKey)) {
          throw new ValidationError('Rate limit exceeded');
        }
      }

      // Create middleware execution context
      const middlewareContext = { ...context };
      let result: any;
      const modifiedArgs = args;
      const modifiedOptions = options;
      const skipRemaining = false;

      // Execute middleware with timeout
      const timeout = middleware.options?.timeout || 30000;
      const middlewarePromise = new Promise<void>((resolve, reject) => {
        middleware.handler(
          modifiedArgs,
          modifiedOptions,
          middlewareContext,
          async () => {
            // Next function - captures modifications
            resolve();
          }
        ).catch(reject);
      });

      await Promise.race([
        middlewarePromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Middleware timeout')), timeout)
        )
      ]);

      // Cache result if enabled
      if (middleware.options?.cache?.enabled && result !== undefined) {
        const cacheKey = this.getCacheKey(middleware, args, options);
        this.setInCache(cacheKey, result, middleware.options.cache.ttl);
      }

      const duration = Date.now() - startTime;
      this.emit('middleware-executed', { 
        id: middleware.id, 
        type: middleware.type,
        duration 
      });

      return {
        success: true,
        duration,
        data: result,
        modified: {
          args: modifiedArgs !== args ? modifiedArgs : undefined,
          options: modifiedOptions !== options ? modifiedOptions : undefined
        },
        skipRemaining
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.emit('middleware-failed', { 
        id: middleware.id, 
        type: middleware.type,
        error,
        duration 
      });

      return {
        success: false,
        duration,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  // Get middleware chain for type and context
  private getMiddlewareChain(
    type: MiddlewareType,
    context: PluginCommandContext
  ): MiddlewareRegistration[] {
    const typeChain = this.typeChains.get(type) || [];
    const commandChain = this.commandMiddleware.get(context.command.name) || [];
    
    const allMiddlewareIds = [...new Set([...typeChain, ...commandChain])];
    
    return allMiddlewareIds
      .map(id => this.middlewares.get(id))
      .filter((m): m is MiddlewareRegistration => 
        m !== undefined && 
        m.isActive && 
        (m.type === type || commandChain.includes(m.id)) &&
        this.appliesTo(m, context)
      )
      .sort((a, b) => b.priority - a.priority);
  }

  // Check if middleware applies to context
  private appliesTo(
    middleware: MiddlewareRegistration,
    context: PluginCommandContext
  ): boolean {
    if (!middleware.appliesTo) {
      return true;
    }

    const filter = middleware.appliesTo;

    if (filter.commands && !filter.commands.includes(context.command.name)) {
      return false;
    }

    if (filter.plugins && !filter.plugins.includes(context.plugin.manifest.name)) {
      return false;
    }

    if (filter.categories && context.command.category && 
        !filter.categories.includes(context.command.category)) {
      return false;
    }

    if (filter.patterns) {
      const matches = filter.patterns.some(pattern => 
        pattern.test(context.command.name)
      );
      if (!matches) return false;
    }

    if (filter.custom && !filter.custom(context)) {
      return false;
    }

    return true;
  }

  // Update type chain after registration/unregistration
  private updateTypeChain(type: MiddlewareType): void {
    const middlewares = Array.from(this.middlewares.values())
      .filter(m => m.type === type && m.isActive)
      .sort((a, b) => b.priority - a.priority)
      .map(m => m.id);

    this.typeChains.set(type, middlewares);
  }

  // Generate unique middleware ID
  private generateMiddlewareId(pluginName: string, type: MiddlewareType): string {
    return `${pluginName}:${type}:${Date.now()}`;
  }

  // Cache management
  private getCacheKey(
    middleware: MiddlewareRegistration,
    args: Record<string, any>,
    options: Record<string, any>
  ): string {
    if (middleware.options?.cache?.key) {
      return middleware.options.cache.key(args, options);
    }
    return `${middleware.id}:${JSON.stringify({ args, options })}`;
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return undefined;
  }

  private setInCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl
    });
  }

  // Rate limiting
  private getRateLimitKey(
    middleware: MiddlewareRegistration,
    context: PluginCommandContext
  ): string {
    return `${context.plugin.manifest.name}:${context.command.name}`;
  }

  private checkRateLimit(
    middleware: MiddlewareRegistration,
    key: string
  ): boolean {
    if (!middleware.options?.rateLimit) return true;

    const { maxRequests, windowMs } = middleware.options.rateLimit;
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!this.rateLimiters.has(middleware.id)) {
      this.rateLimiters.set(middleware.id, new Map());
    }

    const limiter = this.rateLimiters.get(middleware.id)!;
    
    if (!limiter.has(key)) {
      limiter.set(key, []);
    }

    const requests = limiter.get(key)!;
    
    // Remove old requests outside window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= maxRequests) {
      return false;
    }

    validRequests.push(now);
    limiter.set(key, validRequests);
    
    return true;
  }

  // Get all middlewares
  getMiddlewares(): MiddlewareRegistration[] {
    return Array.from(this.middlewares.values());
  }

  // Get middlewares by type
  getMiddlewaresByType(type: MiddlewareType): MiddlewareRegistration[] {
    return Array.from(this.middlewares.values())
      .filter(m => m.type === type);
  }

  // Get middlewares by plugin
  getMiddlewaresByPlugin(pluginName: string): MiddlewareRegistration[] {
    return Array.from(this.middlewares.values())
      .filter(m => m.pluginName === pluginName);
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
    this.emit('cache-cleared');
  }

  // Get statistics
  getStats(): any {
    const stats = {
      totalMiddlewares: this.middlewares.size,
      activeMiddlewares: Array.from(this.middlewares.values()).filter(m => m.isActive).length,
      byType: {} as Record<string, number>,
      byPlugin: {} as Record<string, number>,
      cacheSize: this.cache.size,
      rateLimiters: this.rateLimiters.size
    };

    // Count by type
    Object.values(MiddlewareType).forEach(type => {
      stats.byType[type] = this.getMiddlewaresByType(type).length;
    });

    // Count by plugin
    Array.from(this.middlewares.values()).forEach(m => {
      stats.byPlugin[m.pluginName] = (stats.byPlugin[m.pluginName] || 0) + 1;
    });

    return stats;
  }
}

// Create built-in middleware factories
export const builtinMiddleware: BuiltinMiddleware = {
  // Validation middleware
  validation: (schema: any) => {
    return async (args, options, context, next) => {
      try {
        // Validate against schema (simplified - would use a real validator)
        if (schema.args) {
          Object.entries(schema.args).forEach(([key, rules]: [string, any]) => {
            const value = args[key];
            if (rules.required && value === undefined) {
              throw new ValidationError(`Argument '${key}' is required`);
            }
            if (rules.type && value !== undefined && typeof value !== rules.type) {
              throw new ValidationError(`Argument '${key}' must be of type ${rules.type}`);
            }
          });
        }

        if (schema.options) {
          Object.entries(schema.options).forEach(([key, rules]: [string, any]) => {
            const value = options[key];
            if (rules.required && value === undefined) {
              throw new ValidationError(`Option '${key}' is required`);
            }
            if (rules.type && value !== undefined && typeof value !== rules.type) {
              throw new ValidationError(`Option '${key}' must be of type ${rules.type}`);
            }
          });
        }

        await next();
      } catch (error) {
        context.logger.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    };
  },

  // Authorization middleware
  authorization: (requiredPermissions: string[]) => {
    return async (args, options, context, next) => {
      // Check if plugin has required permissions
      const pluginPermissions = context.plugin.manifest.reshell?.permissions || [];
      
      const hasAllPermissions = requiredPermissions.every(perm => 
        pluginPermissions.includes(perm as any)
      );

      if (!hasAllPermissions) {
        throw new ValidationError(
          `Plugin lacks required permissions: ${requiredPermissions.join(', ')}`
        );
      }

      await next();
    };
  },

  // Rate limiting middleware
  rateLimit: ({ maxRequests, windowMs }) => {
    const requests = new Map<string, number[]>();

    return async (args, options, context, next) => {
      const key = `${context.plugin.manifest.name}:${context.command.name}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      if (!requests.has(key)) {
        requests.set(key, []);
      }

      const keyRequests = requests.get(key)!;
      const validRequests = keyRequests.filter(timestamp => timestamp > windowStart);

      if (validRequests.length >= maxRequests) {
        throw new ValidationError('Rate limit exceeded');
      }

      validRequests.push(now);
      requests.set(key, validRequests);

      await next();
    };
  },

  // Caching middleware
  cache: ({ ttl, key }) => {
    const cache = new Map<string, { data: any; expires: number }>();

    return async (args, options, context, next) => {
      const cacheKey = key ? key(args, options) : JSON.stringify({ args, options });
      
      const cached = cache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        context.logger.debug('Cache hit');
        return cached.data;
      }

      let result: any;
      const originalNext = next;
      
      // Intercept next to capture result
      await originalNext();

      if (result !== undefined) {
        cache.set(cacheKey, {
          data: result,
          expires: Date.now() + ttl
        });
      }

      return result;
    };
  },

  // Logging middleware
  logger: ({ level = 'info', format }: { level?: string; format?: string } = {}) => {
    return async (args, options, context, next) => {
      const startTime = Date.now();
      const commandName = context.command.name;
      const pluginName = context.plugin.manifest.name;

      context.logger.info(`[${pluginName}:${commandName}] Starting execution`);
      
      if (level === 'debug') {
        context.logger.debug(`Arguments: ${JSON.stringify(args)}`);
        context.logger.debug(`Options: ${JSON.stringify(options)}`);
      }

      try {
        await next();
        
        const duration = Date.now() - startTime;
        context.logger.info(`[${pluginName}:${commandName}] Completed in ${duration}ms`);
        
      } catch (error) {
        const duration = Date.now() - startTime;
        context.logger.error(
          `[${pluginName}:${commandName}] Failed after ${duration}ms: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    };
  },

  // Transform middleware
  transform: ({ args: argsTransformer, options: optionsTransformer }) => {
    return async (args, options, context, next) => {
      let transformedArgs = args;
      let transformedOptions = options;

      if (argsTransformer) {
        transformedArgs = argsTransformer(args);
      }

      if (optionsTransformer) {
        transformedOptions = optionsTransformer(options);
      }

      // Update args and options for next middleware
      Object.assign(args, transformedArgs);
      Object.assign(options, transformedOptions);

      await next();
    };
  },

  // Error handler middleware
  errorHandler: (handler) => {
    return async (args, options, context, next) => {
      try {
        await next();
      } catch (error) {
        handler(error instanceof Error ? error : new Error(String(error)), context);
        throw error;
      }
    };
  },

  // Timing middleware
  timing: () => {
    return async (args, options, context, next) => {
      const timings: Record<string, number> = {};
      const startTime = Date.now();

      // Add timing utility to context
      const originalContext = { ...context };
      (context.utils as any).startTimer = (name: string) => {
        timings[name] = Date.now();
      };
      (context.utils as any).endTimer = (name: string) => {
        if (timings[name]) {
          const duration = Date.now() - timings[name];
          context.logger.debug(`${name}: ${duration}ms`);
          return duration;
        }
        return 0;
      };

      try {
        await next();
        
        const totalDuration = Date.now() - startTime;
        context.logger.info(`Total execution time: ${totalDuration}ms`);
        
      } finally {
        // Restore original context
        Object.assign(context, originalContext);
      }
    };
  }
};

// Utility functions
export function createMiddlewareChainManager(): MiddlewareChainManager {
  return new MiddlewareChainManager();
}

export function composeMiddleware(
  ...middlewares: PluginCommandMiddleware[]
): PluginCommandMiddleware {
  return async (args, options, context, next) => {
    let index = 0;

    const dispatch = async (): Promise<void> => {
      if (index >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[index++];
      await middleware(args, options, context, dispatch);
    };

    await dispatch();
  };
}