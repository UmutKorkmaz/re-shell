/**
 * @file Plugin hook system for the re-shell CLI.
 * @description Provides a comprehensive hook/lifecycle system that allows plugins to register
 * handlers for various CLI, command, workspace, file, build, plugin, and configuration events.
 * Includes priority-based execution, middleware support, conditional handlers, and debugging.
 */

import { EventEmitter } from 'events';
import chalk from 'chalk';


/**
 * Built-in hook types that plugins can listen to.
 * @description Enumerates all lifecycle and event hook types available in the system,
 * covering CLI lifecycle, commands, workspace, files, builds, plugins, configuration, and custom hooks.
 */
export enum HookType {
  // CLI lifecycle hooks
  CLI_INIT = 'cli:init',
  CLI_EXIT = 'cli:exit',
  CLI_ERROR = 'cli:error',
  
  // Command hooks
  COMMAND_BEFORE = 'command:before',
  COMMAND_AFTER = 'command:after',
  COMMAND_ERROR = 'command:error',
  COMMAND_REGISTER = 'command:register',
  
  // Workspace hooks
  WORKSPACE_CREATE = 'workspace:create',
  WORKSPACE_UPDATE = 'workspace:update',
  WORKSPACE_DELETE = 'workspace:delete',
  WORKSPACE_BUILD = 'workspace:build',
  
  // File hooks
  FILE_CHANGE = 'file:change',
  FILE_CREATE = 'file:create',
  FILE_DELETE = 'file:delete',
  FILE_WATCH = 'file:watch',
  
  // Build hooks
  BUILD_START = 'build:start',
  BUILD_END = 'build:end',
  BUILD_ERROR = 'build:error',
  BUILD_SUCCESS = 'build:success',
  
  // Plugin hooks
  PLUGIN_LOAD = 'plugin:load',
  PLUGIN_ACTIVATE = 'plugin:activate',
  PLUGIN_DEACTIVATE = 'plugin:deactivate',
  
  // Configuration hooks
  CONFIG_LOAD = 'config:load',
  CONFIG_SAVE = 'config:save',
  CONFIG_VALIDATE = 'config:validate',
  
  // Custom hooks (plugins can define their own)
  CUSTOM = 'custom'
}

/**
 * Priority levels for hook handlers.
 * @description Lower numbers execute first. Use these constants to control the order
 * in which handlers run for a given hook type.
 */
export enum HookPriority {
  /** Executes first, before all other handlers. */
  HIGHEST = 1,
  /** Executes after HIGHEST but before NORMAL handlers. */
  HIGH = 25,
  /** Default priority for handlers when none is specified. */
  NORMAL = 50,
  /** Executes after NORMAL but before LOWEST handlers. */
  LOW = 75,
  /** Executes last, after all other handlers. */
  LOWEST = 100
}

/**
 * Represents a registered hook handler.
 * @description Describes a single handler subscribed to a hook type, including its identity,
 * owning plugin, callback, priority, and optional execution constraints.
 */
export interface HookHandler {
  /** Unique identifier for this handler. */
  id: string;
  /** Name of the plugin that registered this handler. */
  pluginName: string;
  /** The callback function invoked when the hook is executed. */
  handler: (...args: any[]) => any;
  /** Execution priority; lower numbers run first. */
  priority: HookPriority;
  /** If true, the handler is automatically removed after its first invocation. */
  once?: boolean;
  /** Optional predicate that must return true for the handler to execute. */
  condition?: (data: any) => boolean;
  /** Optional human-readable description of what this handler does. */
  description?: string;
  /** Optional arbitrary metadata associated with the handler. */
  metadata?: Record<string, unknown>;
}

/**
 * Context object passed to hook handlers during execution.
 * @description Provides contextual information about the current hook execution,
 * including the hook type, the plugin currently executing, timing, payload data,
 * and any error or abort signals.
 */
export interface HookContext {
  /** The type of hook being executed. */
  hookType: HookType;
  /** Name of the plugin whose handler is currently executing. */
  pluginName: string;
  /** Timestamp (epoch milliseconds) when execution began. */
  timestamp: number;
  /** The data payload passed to the hook. */
  data: any;
  /** The result produced so far during execution, if any. */
  result?: any;
  /** Error encountered during execution, if any. */
  error?: Error;
  /** Whether the hook execution was aborted. */
  aborted?: boolean;
  /** Optional arbitrary metadata for the execution context. */
  metadata?: Record<string, unknown>;
}

/**
 * Result of executing a hook and all its registered handlers.
 * @description Contains the aggregate outcome of running every handler for a hook type,
 * including individual results, errors, abort status, and timing information.
 */
export interface HookResult {
  /** Whether the hook executed successfully with no errors or aborts. */
  success: boolean;
  /** Array of individual handler results. */
  results: any[];
  /** Array of errors encountered, each with the responsible plugin name. */
  errors: Array<{ pluginName: string; error: Error }>;
  /** Whether the hook execution was aborted by a handler. */
  aborted: boolean;
  /** Total execution time in milliseconds. */
  executionTime: number;
  /** The context object associated with this execution. */
  context: HookContext;
}

/**
 * Options used when registering a hook handler.
 * @description Allows configuring the handler's priority, lifetime, execution condition,
 * and optional metadata at registration time.
 */
export interface HookRegistrationOptions {
  /** Execution priority for the handler; defaults to NORMAL. */
  priority?: HookPriority;
  /** If true, the handler is removed after its first successful invocation. */
  once?: boolean;
  /** Optional predicate; the handler only executes when it returns true. */
  condition?: (data: any) => boolean;
  /** Optional human-readable description of the handler. */
  description?: string;
  /** Optional arbitrary metadata to attach to the handler. */
  metadata?: Record<string, unknown>;
}

/**
 * Middleware for intercepting hook execution lifecycle phases.
 * @description Middleware can run logic before handlers execute, after they complete,
 * or when errors occur, enabling cross-cutting concerns such as logging or metrics.
 */
export interface HookMiddleware {
  /** Unique name identifying this middleware. */
  name: string;
  /** Called before any handlers are executed for a hook. */
  before?: (context: HookContext) => Promise<void> | void;
  /** Called after all handlers have finished executing for a hook. */
  after?: (context: HookContext, result: any) => Promise<void> | void;
  /** Called when a handler throws an error during execution. */
  error?: (context: HookContext, error: Error) => Promise<void> | void;
}

/**
 * Central plugin hook system managing registration, execution, and lifecycle of hooks.
 * @description Extends EventEmitter to provide a priority-based hook execution engine
 * with middleware support, conditional handlers, one-time handlers, statistics tracking,
 * and debugging capabilities. Plugins interact with this system to respond to CLI events.
 */
export class PluginHookSystem extends EventEmitter {
  private hooks: Map<HookType, HookHandler[]> = new Map();
  private middleware: HookMiddleware[] = [];
  private executionStats: Map<string, number> = new Map();
  private isEnabled = true;
  private debugMode = false;

  /**
   * Creates a new PluginHookSystem instance.
   * @description Initializes all built-in hook types and registers the default logging middleware.
   * @param options - Optional configuration; set `debugMode` to enable verbose logging.
   */
  constructor(options: { debugMode?: boolean } = {}) {
    super();
    this.debugMode = options.debugMode || false;
    this.initializeBuiltinHooks();
  }

  // Initialize built-in hooks
  private initializeBuiltinHooks(): void {
    // Register all hook types
    Object.values(HookType).forEach(hookType => {
      this.hooks.set(hookType, []);
    });

    // Add default middleware
    this.addMiddleware({
      name: 'logger',
      before: (context) => {
        if (this.debugMode) {
          console.log(chalk.gray(`[Hook] ${context.hookType} - ${context.pluginName}`));
        }
      },
      error: (context, error) => {
        console.error(chalk.red(`[Hook Error] ${context.hookType} - ${context.pluginName}: ${error.message}`));
      }
    });
  }

  /**
   * Registers a handler for a specific hook type.
   * @description Adds the handler to the hook's handler list, sorted by priority,
   * and emits a `hook-registered` event. Supports both built-in and custom hook types.
   * @param hookType - The hook type to listen to (built-in or custom string).
   * @param handler - The callback function to invoke when the hook executes.
   * @param pluginName - The name of the plugin registering the handler.
   * @param options - Optional registration settings (priority, once, condition, etc.).
   * @returns The unique handler ID, which can be used to unregister the handler later.
   */
  register(
    hookType: HookType | string,
    handler: (...args: any[]) => any,
    pluginName: string,
    options: HookRegistrationOptions = {}
  ): string {
    const hookKey = hookType as HookType;
    const handlerId = this.generateHandlerId(pluginName, hookType);
    
    const hookHandler: HookHandler = {
      id: handlerId,
      pluginName,
      handler,
      priority: options.priority || HookPriority.NORMAL,
      once: options.once || false,
      condition: options.condition,
      description: options.description,
      metadata: options.metadata
    };

    // Initialize hook type if it doesn't exist (for custom hooks)
    if (!this.hooks.has(hookKey)) {
      this.hooks.set(hookKey, []);
    }

    // Add handler and sort by priority
    const handlers = this.hooks.get(hookKey)!;
    handlers.push(hookHandler);
    handlers.sort((a, b) => a.priority - b.priority);

    this.emit('hook-registered', {
      hookType: hookKey,
      handlerId,
      pluginName,
      priority: hookHandler.priority
    });

    if (this.debugMode) {
      console.log(chalk.blue(`[Hook] Registered ${hookType} handler for ${pluginName}`));
    }

    return handlerId;
  }

  /**
   * Unregisters a specific hook handler by its ID.
   * @description Removes the handler with the given ID from the specified hook type
   * and emits a `hook-unregistered` event.
   * @param hookType - The hook type the handler was registered for.
   * @param handlerId - The unique ID of the handler to remove.
   * @returns True if the handler was found and removed; false otherwise.
   */
  unregister(hookType: HookType | string, handlerId: string): boolean {
    const hookKey = hookType as HookType;
    const handlers = this.hooks.get(hookKey);
    
    if (!handlers) return false;

    const index = handlers.findIndex(h => h.id === handlerId);
    if (index === -1) return false;

    const removed = handlers.splice(index, 1)[0];
    
    this.emit('hook-unregistered', {
      hookType: hookKey,
      handlerId,
      pluginName: removed.pluginName
    });

    if (this.debugMode) {
      console.log(chalk.yellow(`[Hook] Unregistered ${hookType} handler ${handlerId}`));
    }

    return true;
  }

  /**
   * Unregisters all handlers belonging to a specific plugin across all hook types.
   * @description Removes every handler owned by the given plugin and emits a
   * `plugin-hooks-unregistered` event with the count of removed handlers.
   * @param pluginName - The name of the plugin whose hooks should be removed.
   * @returns The number of handlers that were removed.
   */
  unregisterAll(pluginName: string): number {
    let removed = 0;
    
    for (const [hookType, handlers] of this.hooks.entries()) {
      const initialLength = handlers.length;
      this.hooks.set(hookType, handlers.filter(h => h.pluginName !== pluginName));
      removed += initialLength - handlers.length;
    }

    this.emit('plugin-hooks-unregistered', { pluginName, removed });

    if (this.debugMode && removed > 0) {
      console.log(chalk.yellow(`[Hook] Unregistered ${removed} hooks for plugin ${pluginName}`));
    }

    return removed;
  }

  /**
   * Executes all handlers registered for a hook type asynchronously.
   * @description Runs middleware before/after phases, invokes each handler in priority order,
   * respects conditional and one-time handlers, collects results and errors, and supports
   * abort signals. Emits a `hooks-executed` event upon completion.
   * @param hookType - The hook type to execute.
   * @param data - Optional data payload to pass to each handler.
   * @returns A HookResult containing aggregate results, errors, timing, and context.
   */
  async execute(hookType: HookType | string, data: Record<string, unknown> = {}): Promise<HookResult> {
    if (!this.isEnabled) {
      return {
        success: true,
        results: [],
        errors: [],
        aborted: false,
        executionTime: 0,
        context: {
          hookType: hookType as HookType,
          pluginName: 'system',
          timestamp: Date.now(),
          data
        }
      };
    }

    const startTime = Date.now();
    const hookKey = hookType as HookType;
    const handlers = this.hooks.get(hookKey) || [];
    
    const context: HookContext = {
      hookType: hookKey,
      pluginName: 'system',
      timestamp: startTime,
      data,
      metadata: {}
    };

    const result: HookResult = {
      success: true,
      results: [],
      errors: [],
      aborted: false,
      executionTime: 0,
      context
    };

    if (handlers.length === 0) {
      result.executionTime = Date.now() - startTime;
      return result;
    }

    try {
      // Execute middleware before hooks
      await this.executeMiddleware('before', context);

      // Execute handlers
      for (const handler of handlers) {
        // Check condition if specified
        if (handler.condition && !handler.condition(data)) {
          continue;
        }

        context.pluginName = handler.pluginName;

        try {
          const handlerStartTime = Date.now();
          
          // Execute handler
          const handlerResult = await Promise.resolve(handler.handler(data, context));
          
          // Track execution time
          const executionTime = Date.now() - handlerStartTime;
          this.updateExecutionStats(handler.pluginName, executionTime);

          result.results.push({
            pluginName: handler.pluginName,
            handlerId: handler.id,
            result: handlerResult,
            executionTime
          });

          // Remove one-time handlers
          if (handler.once) {
            this.unregister(hookType, handler.id);
          }

          // Check for abort signal
          if (handlerResult && handlerResult.abort) {
            result.aborted = true;
            break;
          }

        } catch (error) {
          const hookError = error instanceof Error ? error : new Error(String(error));
          
          result.errors.push({
            pluginName: handler.pluginName,
            error: hookError
          });

          context.error = hookError;

          // Execute middleware error handler
          await this.executeMiddleware('error', context, hookError);

          // Continue with other handlers unless it's a critical error
          if (hookError.message.includes('CRITICAL')) {
            result.aborted = true;
            break;
          }
        }
      }

      // Execute middleware after hooks
      await this.executeMiddleware('after', context, result.results);

    } catch (error) {
      result.success = false;
      result.errors.push({
        pluginName: 'system',
        error: error instanceof Error ? error : new Error(String(error))
      });
    }

    result.success = result.errors.length === 0 && !result.aborted;
    result.executionTime = Date.now() - startTime;

    this.emit('hooks-executed', {
      hookType: hookKey,
      handlersCount: handlers.length,
      resultsCount: result.results.length,
      errorsCount: result.errors.length,
      executionTime: result.executionTime,
      success: result.success
    });

    return result;
  }

  /**
   * Executes all handlers for a hook type synchronously.
   * @description A simpler, non-async variant of execute that does not invoke middleware.
   * Useful for cases where async overhead is unnecessary. Errors are caught and logged
   * in debug mode rather than propagated.
   * @param hookType - The hook type to execute.
   * @param data - Optional data payload to pass to each handler.
   * @returns An array of handler results, each with the plugin name and result value.
   */
  executeSync(hookType: HookType | string, data: Record<string, unknown> = {}): any[] {
    if (!this.isEnabled) return [];

    const hookKey = hookType as HookType;
    const handlers = this.hooks.get(hookKey) || [];
    const results: any[] = [];

    for (const handler of handlers) {
      // Check condition if specified
      if (handler.condition && !handler.condition(data)) {
        continue;
      }

      try {
        const context: HookContext = {
          hookType: hookKey,
          pluginName: handler.pluginName,
          timestamp: Date.now(),
          data
        };

        const result = handler.handler(data, context);
        results.push({
          pluginName: handler.pluginName,
          result
        });

        // Remove one-time handlers
        if (handler.once) {
          this.unregister(hookType, handler.id);
        }

      } catch (error) {
        if (this.debugMode) {
          console.error(chalk.red(`[Hook Error] ${hookType} - ${handler.pluginName}: ${error}`));
        }
      }
    }

    return results;
  }

  /**
   * Adds a middleware to the hook system.
   * @description Middleware intercept hook lifecycle phases (before, after, error).
   * Emits a `middleware-added` event.
   * @param middleware - The middleware object to add.
   */
  addMiddleware(middleware: HookMiddleware): void {
    this.middleware.push(middleware);
    
    this.emit('middleware-added', { name: middleware.name });

    if (this.debugMode) {
      console.log(chalk.green(`[Hook] Added middleware: ${middleware.name}`));
    }
  }

  /**
   * Removes a middleware by its name.
   * @description Finds and removes the middleware with the matching name.
   * Emits a `middleware-removed` event.
   * @param name - The name of the middleware to remove.
   * @returns True if the middleware was found and removed; false otherwise.
   */
  removeMiddleware(name: string): boolean {
    const index = this.middleware.findIndex(m => m.name === name);
    if (index === -1) return false;

    this.middleware.splice(index, 1);
    
    this.emit('middleware-removed', { name });

    if (this.debugMode) {
      console.log(chalk.yellow(`[Hook] Removed middleware: ${name}`));
    }

    return true;
  }

  // Execute middleware
  private async executeMiddleware(
    phase: 'before' | 'after' | 'error',
    context: HookContext,
    extra?: any
  ): Promise<void> {
    for (const middleware of this.middleware) {
      try {
        if (phase === 'before' && middleware.before) {
          await middleware.before(context);
        } else if (phase === 'after' && middleware.after) {
          await middleware.after(context, extra);
        } else if (phase === 'error' && middleware.error) {
          await middleware.error(context, extra);
        }
      } catch (error) {
        if (this.debugMode) {
          console.error(chalk.red(`[Middleware Error] ${middleware.name}: ${error}`));
        }
      }
    }
  }

  /**
   * Retrieves registered hooks, optionally filtered by hook type.
   * @description When a hook type is provided, returns the handlers for that type.
   * When omitted, returns the entire hook-to-handlers map.
   * @param hookType - Optional hook type to filter by.
   * @returns An array of handlers for the given type, or a Map of all hooks if no type is given.
   */
  getHooks(hookType?: HookType | string): Map<HookType, HookHandler[]> | HookHandler[] {
    if (hookType) {
      return this.hooks.get(hookType as HookType) || [];
    }
    return new Map(this.hooks);
  }

  /**
   * Retrieves all hook handlers registered by a specific plugin.
   * @description Searches across all hook types and returns every handler owned by the plugin.
   * @param pluginName - The name of the plugin to query.
   * @returns An array of HookHandler objects registered by the plugin.
   */
  getPluginHooks(pluginName: string): HookHandler[] {
    const pluginHooks: HookHandler[] = [];
    
    for (const handlers of this.hooks.values()) {
      pluginHooks.push(...handlers.filter(h => h.pluginName === pluginName));
    }

    return pluginHooks;
  }

  /**
   * Retrieves statistics about the hook system.
   * @description Returns aggregate counts of hooks by type and plugin, execution time
   * statistics, and the list of registered middleware names.
   * @returns A statistics object with totalHooks, hooksByType, hooksByPlugin, executionStats, and middleware fields.
   */
  getStats(): any {
    const stats = {
      totalHooks: 0,
      hooksByType: {} as Record<string, number>,
      hooksByPlugin: {} as Record<string, number>,
      executionStats: Object.fromEntries(this.executionStats),
      middleware: this.middleware.map(m => m.name)
    };

    for (const [hookType, handlers] of this.hooks.entries()) {
      stats.totalHooks += handlers.length;
      stats.hooksByType[hookType] = handlers.length;

      for (const handler of handlers) {
        stats.hooksByPlugin[handler.pluginName] = 
          (stats.hooksByPlugin[handler.pluginName] || 0) + 1;
      }
    }

    return stats;
  }

  // Update execution statistics
  private updateExecutionStats(pluginName: string, executionTime: number): void {
    const currentTime = this.executionStats.get(pluginName) || 0;
    this.executionStats.set(pluginName, currentTime + executionTime);
  }

  // Generate handler ID
  private generateHandlerId(pluginName: string, hookType: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `${pluginName}_${hookType}_${timestamp}_${random}`;
  }

  /**
   * Enables or disables the entire hook system.
   * @description When disabled, `execute` returns immediately with a no-op result.
   * Emits a `system-toggled` event.
   * @param enabled - True to enable the system; false to disable.
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.emit('system-toggled', { enabled });
  }

  /**
   * Toggles debug mode for verbose logging.
   * @description When enabled, the system logs hook registrations, executions, and errors.
   * Emits a `debug-toggled` event.
   * @param debug - True to enable debug mode; false to disable.
   */
  setDebugMode(debug: boolean): void {
    this.debugMode = debug;
    this.emit('debug-toggled', { debug });
  }

  /**
   * Clears all registered hooks and resets the system to its initial state.
   * @description Removes all handlers, resets execution statistics, re-initializes
   * built-in hooks, and re-adds the default middleware. Emits a `system-cleared` event.
   */
  clear(): void {
    this.hooks.clear();
    this.executionStats.clear();
    this.initializeBuiltinHooks();
    this.emit('system-cleared');
  }

  /**
   * Creates a plugin-scoped API instance for convenient hook management.
   * @description Returns a PluginHookAPI bound to the given plugin name, so the plugin
   * does not need to pass its name on every call.
   * @param pluginName - The name of the plugin to scope the API to.
   * @returns A PluginHookAPI instance for the specified plugin.
   */
  createPluginScope(pluginName: string): PluginHookAPI {
    return new PluginHookAPI(this, pluginName);
  }
}

/**
 * Plugin-scoped API for interacting with the hook system.
 * @description Wraps the PluginHookSystem with a bound plugin name so that plugins
 * can register, unregister, and execute hooks without repeating their identity.
 * Also provides convenience methods for common hook patterns.
 */
export class PluginHookAPI {
  constructor(
    private hookSystem: PluginHookSystem,
    private pluginName: string
  ) {}

  /**
   * Registers a hook handler on behalf of the bound plugin.
   * @description Delegates to PluginHookSystem.register with the plugin's name automatically supplied.
   * @param hookType - The hook type to listen to.
   * @param handler - The callback function invoked when the hook executes.
   * @param options - Optional registration settings (priority, once, condition, etc.).
   * @returns The unique handler ID for the registration.
   */
  register(
    hookType: HookType | string,
    handler: (...args: any[]) => any,
    options?: HookRegistrationOptions
  ): string {
    return this.hookSystem.register(hookType, handler, this.pluginName, options);
  }

  /**
   * Unregisters a hook handler by its ID.
   * @description Delegates to PluginHookSystem.unregister.
   * @param hookType - The hook type the handler was registered for.
   * @param handlerId - The unique ID of the handler to remove.
   * @returns True if the handler was found and removed; false otherwise.
   */
  unregister(hookType: HookType | string, handlerId: string): boolean {
    return this.hookSystem.unregister(hookType, handlerId);
  }

  /**
   * Executes all handlers for a hook type asynchronously.
   * @description Delegates to PluginHookSystem.execute.
   * @param hookType - The hook type to execute.
   * @param data - Optional data payload to pass to handlers.
   * @returns A HookResult containing aggregate results, errors, and timing.
   */
  async execute(hookType: HookType | string, data?: any): Promise<HookResult> {
    return this.hookSystem.execute(hookType, data);
  }

  /**
   * Executes all handlers for a hook type synchronously.
   * @description Delegates to PluginHookSystem.executeSync.
   * @param hookType - The hook type to execute.
   * @param data - Optional data payload to pass to handlers.
   * @returns An array of handler results.
   */
  executeSync(hookType: HookType | string, data?: any): any[] {
    return this.hookSystem.executeSync(hookType, data);
  }

  /**
   * Retrieves all hooks registered by the bound plugin.
   * @description Delegates to PluginHookSystem.getPluginHooks with the plugin's name.
   * @returns An array of HookHandler objects owned by this plugin.
   */
  getHooks(): HookHandler[] {
    return this.hookSystem.getPluginHooks(this.pluginName);
  }

  /**
   * Generates a custom hook type name scoped to the plugin.
   * @description Creates a namespaced hook type string in the format `pluginName:name`
   * so plugins can define and execute their own custom hooks without collisions.
   * @param name - The descriptive name for the custom hook.
   * @returns The fully qualified custom hook type string.
   */
  registerCustomHook(name: string): string {
    const customHookType = `${this.pluginName}:${name}`;
    return customHookType;
  }

  /**
   * Registers a handler that fires before a specific command is executed.
   * @description Convenience wrapper that listens to COMMAND_BEFORE and only invokes
   * the handler when the command name matches.
   * @param command - The command name to match.
   * @param handler - The callback function to invoke when the command runs.
   * @param options - Optional registration settings.
   * @returns The unique handler ID for the registration.
   */
  onCommand(command: string, handler: (...args: any[]) => any, options?: HookRegistrationOptions): string {
    return this.register(
      HookType.COMMAND_BEFORE,
      (data: any, context: HookContext) => {
        if (data.command === command) {
          return handler(data, context);
        }
      },
      options
    );
  }

  /**
   * Registers a handler that fires when a file matching the given pattern changes.
   * @description Convenience wrapper that listens to FILE_CHANGE and invokes the handler
   * only when the file path matches the provided string or RegExp pattern.
   * @param pattern - A RegExp or string to match against the changed file path.
   * @param handler - The callback function to invoke on matching file changes.
   * @param options - Optional registration settings.
   * @returns The unique handler ID for the registration.
   */
  onFileChange(pattern: RegExp | string, handler: (...args: any[]) => any, options?: HookRegistrationOptions): string {
    return this.register(
      HookType.FILE_CHANGE,
      (data: any, context: HookContext) => {
        const filePath = data.filePath || data.path;
        if (pattern instanceof RegExp ? pattern.test(filePath) : filePath.includes(pattern)) {
          return handler(data, context);
        }
      },
      options
    );
  }

  /**
   * Registers a handler that fires when a build starts for a specific workspace.
   * @description Convenience wrapper that listens to BUILD_START and invokes the handler
   * when the workspace name matches, or when `'*'` is passed to match all workspaces.
   * @param workspace - The workspace name to match, or `'*'` for all workspaces.
   * @param handler - The callback function to invoke when the build starts.
   * @param options - Optional registration settings.
   * @returns The unique handler ID for the registration.
   */
  onWorkspaceBuild(workspace: string, handler: (...args: any[]) => any, options?: HookRegistrationOptions): string {
    return this.register(
      HookType.BUILD_START,
      (data: any, context: HookContext) => {
        if (data.workspace === workspace || workspace === '*') {
          return handler(data, context);
        }
      },
      options
    );
  }
}

/**
 * Creates and returns a new PluginHookSystem instance.
 * @description Factory function for instantiating a hook system with optional debug mode.
 * @param options - Optional configuration; set `debugMode` to enable verbose logging.
 * @returns A new PluginHookSystem instance.
 */
export function createHookSystem(options?: { debugMode?: boolean }): PluginHookSystem {
  return new PluginHookSystem(options);
}

/**
 * Checks whether a string is a valid built-in hook type.
 * @description Validates the given string against all values of the HookType enum.
 * @param hookType - The string to validate.
 * @returns True if the string matches a built-in HookType value; false otherwise.
 */
export function isValidHookType(hookType: string): boolean {
  return Object.values(HookType).includes(hookType as HookType);
}

/** Alias for the HookType enum, re-exported as BuiltinHooks. */
export { HookType as BuiltinHooks };