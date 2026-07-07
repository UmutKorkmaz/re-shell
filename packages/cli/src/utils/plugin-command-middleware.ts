import { EventEmitter } from 'events';

import { ValidationError } from './error-handler';
import { PluginCommandContext, PluginCommandMiddleware } from './plugin-command-registry';
import type { PluginPermission } from './plugin-system';

/**
 * Enumerates the supported middleware lifecycle phases and categories.
 *
 * Middlewares are categorized by type so that they can be grouped into chains
 * that execute at specific points during a plugin command's lifecycle
 * (e.g. before validation, after execution) or by cross-cutting concern
 * (e.g. logging, caching, rate limiting).
 */
export enum MiddlewareType {
  /** Runs before the validation phase to allow early argument normalization or rejection. */
  PRE_VALIDATION = 'pre-validation',
  /** Validates command arguments and options against a schema or rule set. */
  VALIDATION = 'validation',
  /** Runs immediately before the command handler is invoked. */
  PRE_EXECUTION = 'pre-execution',
  /** Runs after the command handler has completed successfully. */
  POST_EXECUTION = 'post-execution',
  /** Handles errors thrown during the middleware chain or command execution. */
  ERROR_HANDLER = 'error-handler',
  /** Logs execution details such as start, completion, and failure events. */
  LOGGER = 'logger',
  /** Enforces request rate limits per plugin/command combination. */
  RATE_LIMITER = 'rate-limiter',
  /** Caches middleware results to avoid redundant computation. */
  CACHE = 'cache',
  /** Transforms arguments or options before they reach subsequent middlewares. */
  TRANSFORM = 'transform',
  /** Verifies that the invoking plugin holds the required permissions. */
  AUTHORIZATION = 'authorization'
}

/**
 * Represents a registered middleware entry managed by the {@link MiddlewareChainManager}.
 *
 * A registration record tracks the middleware's identity, owning plugin, type,
 * execution priority, runtime options, and any filters that determine the
 * commands or contexts to which it applies.
 */
export interface MiddlewareRegistration {
  /** Unique identifier generated for the middleware registration. */
  id: string;
  /** Name of the plugin that registered the middleware. */
  pluginName: string;
  /** Lifecycle phase or category the middleware belongs to. */
  type: MiddlewareType;
  /** Numeric priority; higher values execute earlier within a chain. */
  priority: number;
  /** The underlying handler function invoked when the middleware executes. */
  handler: PluginCommandMiddleware;
  /** Optional runtime options such as timeout, caching, and rate limiting. */
  options?: MiddlewareOptions;
  /** Whether the middleware is currently active and eligible for execution. */
  isActive: boolean;
  /** Optional filter restricting the commands, plugins, or categories the middleware applies to. */
  appliesTo?: MiddlewareFilter;
  /** Arbitrary plugin-defined metadata associated with the registration. */
  metadata?: Record<string, unknown>;
}

/**
 * Runtime options that control how a middleware executes.
 *
 * These options enable features such as execution timeouts, error handling
 * behavior, caching, and rate limiting without requiring custom logic in
 * the middleware handler itself.
 */
export interface MiddlewareOptions {
  /** Maximum execution time in milliseconds before the middleware is aborted. */
  timeout?: number;
  /** When true, remaining middlewares are skipped after this middleware errors. */
  skipOnError?: boolean;
  /** When true, the middleware may be executed asynchronously without blocking the chain. */
  runAsync?: boolean;
  /** Optional caching configuration for storing and reusing middleware results. */
  cache?: {
    /** Whether caching is enabled for the middleware. */
    enabled: boolean;
    /** Time-to-live for cached entries in milliseconds. */
    ttl: number;
    /** Optional custom function used to build the cache key from args and options. */
    key?: (args: any, options: any) => string;
  };
  /** Optional rate limiting configuration applied to middleware invocations. */
  rateLimit?: {
    /** Maximum number of requests allowed within the rolling time window. */
    maxRequests: number;
    /** Length of the rate limiting window in milliseconds. */
    windowMs: number;
    /** When true, failed requests are excluded from rate limit counts. */
    skipFailedRequests?: boolean;
  };
}

/**
 * Filter criteria used to determine the commands, plugins, and contexts
 * to which a middleware applies.
 *
 * All specified conditions must match for the middleware to be included in
 * the execution chain for a given command context.
 */
export interface MiddlewareFilter {
  /** Optional list of command names the middleware applies to. */
  commands?: string[];
  /** Optional list of plugin names the middleware applies to. */
  plugins?: string[];
  /** Optional list of command categories the middleware applies to. */
  categories?: string[];
  /** Optional regular expressions tested against the command name. */
  patterns?: RegExp[];
  /** Optional custom predicate evaluated against the command context. */
  custom?: (context: PluginCommandContext) => boolean;
}

/**
 * Describes the outcome of executing a single middleware or an entire chain.
 *
 * The result captures whether execution succeeded, how long it took, any
 * error encountered, optional returned data, modifications made to args or
 * options, and whether subsequent middlewares should be skipped.
 */
export interface MiddlewareResult {
  /** Whether the middleware (or chain) completed without throwing. */
  success: boolean;
  /** Total execution duration in milliseconds. */
  duration: number;
  /** Error captured when execution failed, if any. */
  error?: Error;
  /** Optional data returned by the middleware. */
  data?: any;
  /** Optional modifications applied to the command arguments or options. */
  modified?: {
    /** Modified argument values to merge into the running arguments. */
    args?: Record<string, unknown>;
    /** Modified option values to merge into the running options. */
    options?: Record<string, unknown>;
  };
  /** When true, signals that remaining middlewares in the chain should be skipped. */
  skipRemaining?: boolean;
}

/**
 * Collection of factory functions that produce common, reusable middleware
 * handlers. Each factory returns a {@link PluginCommandMiddleware} configured
 * for a specific cross-cutting concern.
 */
export interface BuiltinMiddleware {
  /**
   * Creates a validation middleware that checks arguments and options against a schema.
   * @param schema - Schema describing required fields and expected types for arguments and options.
   * @returns A {@link PluginCommandMiddleware} that validates the incoming command data.
   */
  validation: (schema: any) => PluginCommandMiddleware;
  /**
   * Creates an authorization middleware that ensures the invoking plugin holds the required permissions.
   * @param permissions - List of permission identifiers required to proceed.
   * @returns A {@link PluginCommandMiddleware} that enforces the permission requirements.
   */
  authorization: (permissions: string[]) => PluginCommandMiddleware;
  /**
   * Creates a rate limiting middleware that restricts request frequency.
   * @param options - Rate limiting configuration including max requests and time window.
   * @param options.maxRequests - Maximum number of requests permitted within the window.
   * @param options.windowMs - Duration of the rate limiting window in milliseconds.
   * @returns A {@link PluginCommandMiddleware} that enforces the rate limit.
   */
  rateLimit: (options: { maxRequests: number; windowMs: number }) => PluginCommandMiddleware;
  /**
   * Creates a caching middleware that stores results to avoid redundant computation.
   * @param options - Cache configuration including time-to-live and optional key generator.
   * @param options.ttl - Time-to-live for cached entries in milliseconds.
   * @param options.key - Optional function used to build cache keys from args and options.
   * @returns A {@link PluginCommandMiddleware} that caches results.
   */
  cache: (options: { ttl: number; key?: (args: any, options: any) => string }) => PluginCommandMiddleware;
  /**
   * Creates a logging middleware that records execution lifecycle events.
   * @param options - Optional logging configuration including level and format.
   * @param options.level - Log level to use (e.g. "info" or "debug").
   * @param options.format - Optional custom log format.
   * @returns A {@link PluginCommandMiddleware} that logs execution details.
   */
  logger: (options?: { level: string; format?: string }) => PluginCommandMiddleware;
  /**
   * Creates a transform middleware that mutates arguments and options before downstream execution.
   * @param transformers - Optional transformer functions for args and options.
   * @param transformers.args - Function used to transform the command arguments.
   * @param transformers.options - Function used to transform the command options.
   * @returns A {@link PluginCommandMiddleware} that applies the transformations.
   */
  transform: (transformers: { args?: (args: any) => any; options?: (options: any) => any }) => PluginCommandMiddleware;
  /**
   * Creates an error handler middleware that intercepts and reports errors thrown downstream.
   * @param handler - Callback invoked with the captured error and the active command context.
   * @returns A {@link PluginCommandMiddleware} that wraps downstream execution in error handling.
   */
  errorHandler: (handler: (error: Error, context: PluginCommandContext) => void) => PluginCommandMiddleware;
  /**
   * Creates a timing middleware that records execution durations and exposes timer utilities.
   * @returns A {@link PluginCommandMiddleware} that instruments execution timing.
   */
  timing: () => PluginCommandMiddleware;
}

/**
 * Manages registration, ordering, and execution of plugin command middleware chains.
 *
 * The manager maintains middleware registrations grouped by {@link MiddlewareType},
 * supports command-specific middleware, and emits lifecycle events via the
 * underlying {@link EventEmitter}. It also provides integrated caching and
 * rate limiting facilities driven by {@link MiddlewareOptions}.
 */
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

  /**
   * Initializes an empty chain for each value of {@link MiddlewareType}.
   */
  private initializeTypeChains(): void {
    Object.values(MiddlewareType).forEach(type => {
      this.typeChains.set(type, []);
    });
  }

  /**
   * Registers a new middleware with the chain manager.
   *
   * The middleware is stored, the relevant type chain is refreshed, and a
   * `middleware-registered` event is emitted.
   *
   * @param pluginName - Name of the plugin registering the middleware.
   * @param type - Lifecycle phase or category the middleware belongs to.
   * @param handler - Function invoked when the middleware executes.
   * @param options - Optional registration options including priority, runtime options, filters, and metadata.
   * @returns The unique identifier assigned to the newly registered middleware.
   */
  registerMiddleware(
    pluginName: string,
    type: MiddlewareType,
    handler: PluginCommandMiddleware,
    options?: {
      priority?: number;
      options?: MiddlewareOptions;
      appliesTo?: MiddlewareFilter;
      metadata?: Record<string, unknown>;
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

  /**
   * Removes a previously registered middleware by its identifier.
   *
   * The middleware is deleted from the manager, its type chain is refreshed,
   * and any command-specific associations are cleaned up. A
   * `middleware-unregistered` event is emitted on success.
   *
   * @param id - Identifier of the middleware to remove.
   * @returns `true` if the middleware was found and removed; `false` otherwise.
   */
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

  /**
   * Associates an existing middleware with a specific command.
   *
   * If the middleware is already associated with the command, the call is a no-op.
   *
   * @param commandId - Name or identifier of the command.
   * @param middlewareId - Identifier of the middleware to associate.
   */
  registerCommandMiddleware(commandId: string, middlewareId: string): void {
    if (!this.commandMiddleware.has(commandId)) {
      this.commandMiddleware.set(commandId, []);
    }
    
    const middlewareIds = this.commandMiddleware.get(commandId)!;
    if (!middlewareIds.includes(middlewareId)) {
      middlewareIds.push(middlewareId);
    }
  }

  /**
   * Executes the middleware chain for a given type and command context.
   *
   * Middlewares run in priority order, with their argument and option
   * modifications merged into the running state. Execution stops early when
   * a middleware signals `skipRemaining` or when a non-skippable error occurs.
   *
   * @param type - The middleware category whose chain should be executed.
   * @param args - Initial command arguments passed to each middleware.
   * @param options - Initial command options passed to each middleware.
   * @param context - Execution context describing the plugin and command.
   * @returns A {@link MiddlewareResult} describing the chain outcome and any modifications.
   */
  async executeChain(
    type: MiddlewareType,
    args: Record<string, unknown>,
    options: Record<string, unknown>,
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

  /**
   * Executes a single middleware, honoring configured caching, rate limiting,
   * and timeout options.
   *
   * @param middleware - The middleware registration to execute.
   * @param args - Command arguments at the current point in the chain.
   * @param options - Command options at the current point in the chain.
   * @param context - Execution context describing the plugin and command.
   * @returns A {@link MiddlewareResult} describing the middleware outcome.
   */
  private async executeMiddleware(
    middleware: MiddlewareRegistration,
    args: Record<string, unknown>,
    options: Record<string, unknown>,
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

  /**
   * Builds the ordered list of middlewares applicable to a type and context.
   *
   * Combines type-level and command-level registrations, filters inactive or
   * non-applicable entries, and sorts the remaining middlewares by priority
   * (descending).
   *
   * @param type - The middleware category to build the chain for.
   * @param context - Execution context used to evaluate applicability filters.
   * @returns Ordered array of middleware registrations to execute.
   */
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

  /**
   * Determines whether a middleware should run for the given command context
   * by evaluating its {@link MiddlewareFilter} criteria.
   *
   * @param middleware - The middleware whose filter is being evaluated.
   * @param context - Execution context describing the plugin and command.
   * @returns `true` if the middleware applies; `false` otherwise.
   */
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

  /**
   * Rebuilds the priority-ordered chain of middleware IDs for a given type.
   *
   * @param type - The middleware category whose chain should be refreshed.
   */
  private updateTypeChain(type: MiddlewareType): void {
    const middlewares = Array.from(this.middlewares.values())
      .filter(m => m.type === type && m.isActive)
      .sort((a, b) => b.priority - a.priority)
      .map(m => m.id);

    this.typeChains.set(type, middlewares);
  }

  /**
   * Generates a unique identifier for a middleware registration.
   *
   * @param pluginName - Name of the registering plugin.
   * @param type - Middleware category.
   * @returns A unique identifier string combining the plugin, type, and timestamp.
   */
  private generateMiddlewareId(pluginName: string, type: MiddlewareType): string {
    return `${pluginName}:${type}:${Date.now()}`;
  }

  /**
   * Computes the cache key for a middleware invocation, preferring the
   * configured key generator and falling back to a serialized representation.
   *
   * @param middleware - The middleware to compute a key for.
   * @param args - Command arguments used in the key.
   * @param options - Command options used in the key.
   * @returns The computed cache key string.
   */
  private getCacheKey(
    middleware: MiddlewareRegistration,
    args: Record<string, unknown>,
    options: Record<string, unknown>
  ): string {
    if (middleware.options?.cache?.key) {
      return middleware.options.cache.key(args, options);
    }
    return `${middleware.id}:${JSON.stringify({ args, options })}`;
  }

  /**
   * Retrieves a value from the cache if it exists and has not expired.
   *
   * @param key - Cache key to look up.
   * @returns The cached data, or `undefined` when the entry is missing or expired.
   */
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return undefined;
  }

  /**
   * Stores a value in the cache with the specified time-to-live.
   *
   * @param key - Cache key to associate with the value.
   * @param data - Value to cache.
   * @param ttl - Time-to-live in milliseconds from now.
   */
  private setInCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl
    });
  }

  /**
   * Builds the rate limit key used to bucket requests for a middleware.
   *
   * @param middleware - The middleware to build a key for.
   * @param context - Execution context describing the plugin and command.
   * @returns A rate limit key scoped to the plugin and command.
   */
  private getRateLimitKey(
    middleware: MiddlewareRegistration,
    context: PluginCommandContext
  ): string {
    return `${context.plugin.manifest.name}:${context.command.name}`;
  }

  /**
   * Evaluates the rate limit for a middleware and key, recording the current
   * request timestamp when permitted.
   *
   * @param middleware - The middleware whose rate limit configuration applies.
   * @param key - Rate limit bucket key.
   * @returns `true` when the request is allowed; `false` when the limit has been exceeded.
   */
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

  /**
   * Returns all registered middlewares regardless of type or active state.
   *
   * @returns Array of all middleware registrations.
   */
  getMiddlewares(): MiddlewareRegistration[] {
    return Array.from(this.middlewares.values());
  }

  /**
   * Returns all middlewares matching a specific type.
   *
   * @param type - Middleware category to filter by.
   * @returns Array of middleware registrations of the given type.
   */
  getMiddlewaresByType(type: MiddlewareType): MiddlewareRegistration[] {
    return Array.from(this.middlewares.values())
      .filter(m => m.type === type);
  }

  /**
   * Returns all middlewares registered by a specific plugin.
   *
   * @param pluginName - Name of the plugin to filter by.
   * @returns Array of middleware registrations owned by the plugin.
   */
  getMiddlewaresByPlugin(pluginName: string): MiddlewareRegistration[] {
    return Array.from(this.middlewares.values())
      .filter(m => m.pluginName === pluginName);
  }

  /**
   * Removes all entries from the middleware cache and emits a `cache-cleared` event.
   */
  clearCache(): void {
    this.cache.clear();
    this.emit('cache-cleared');
  }

  /**
   * Aggregates statistics describing the current state of the manager.
   *
   * The returned object includes total and active middleware counts,
   * breakdowns by type and plugin, cache size, and rate limiter counts.
   *
   * @returns A statistics object summarizing registered middlewares and caches.
   */
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

/**
 * Built-in middleware factory implementations providing common reusable
 * middleware handlers for validation, authorization, rate limiting,
 * caching, logging, transformation, error handling, and timing.
 */
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
        pluginPermissions.includes(perm as unknown as PluginPermission)
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
      (context.utils as Record<string, unknown>).startTimer = (name: string) => {
        timings[name] = Date.now();
      };
      (context.utils as Record<string, unknown>).endTimer = (name: string) => {
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

/**
 * Creates and returns a new {@link MiddlewareChainManager} instance.
 *
 * @returns A freshly initialized middleware chain manager.
 */
export function createMiddlewareChainManager(): MiddlewareChainManager {
  return new MiddlewareChainManager();
}

/**
 * Composes multiple middlewares into a single middleware that executes them
 * in order, chaining each to the next before invoking the provided `next`
 * callback.
 *
 * @param middlewares - Ordered list of middleware handlers to compose.
 * @returns A single {@link PluginCommandMiddleware} representing the composed chain.
 */
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