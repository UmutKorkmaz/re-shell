import { EventEmitter } from 'events';
import chalk from 'chalk';
import { ValidationError } from './error-handler';

// Hook types and priorities
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

export enum HookPriority {
  HIGHEST = 1,
  HIGH = 25,
  NORMAL = 50,
  LOW = 75,
  LOWEST = 100
}

// Hook handler interface
export interface HookHandler {
  id: string;
  pluginName: string;
  handler: (...args: any[]) => any;
  priority: HookPriority;
  once?: boolean;
  condition?: (data: any) => boolean;
  description?: string;
  metadata?: Record<string, any>;
}

// Hook execution context
export interface HookContext {
  hookType: HookType;
  pluginName: string;
  timestamp: number;
  data: any;
  result?: any;
  error?: Error;
  aborted?: boolean;
  metadata?: Record<string, any>;
}

// Hook execution result
export interface HookResult {
  success: boolean;
  results: any[];
  errors: Array<{ pluginName: string; error: Error }>;
  aborted: boolean;
  executionTime: number;
  context: HookContext;
}

// Hook registration options
export interface HookRegistrationOptions {
  priority?: HookPriority;
  once?: boolean;
  condition?: (data: any) => boolean;
  description?: string;
  metadata?: Record<string, any>;
}

// Hook middleware interface
export interface HookMiddleware {
  name: string;
  before?: (context: HookContext) => Promise<void> | void;
  after?: (context: HookContext, result: any) => Promise<void> | void;
  error?: (context: HookContext, error: Error) => Promise<void> | void;
}

// Plugin hooks system
export class PluginHookSystem extends EventEmitter {
  private hooks: Map<HookType, HookHandler[]> = new Map();
  private middleware: HookMiddleware[] = [];
  private executionStats: Map<string, number> = new Map();
  private isEnabled = true;
  private debugMode = false;

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

  // Register a hook handler
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

  // Unregister a hook handler
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

  // Unregister all hooks for a plugin
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

  // Execute hooks
  async execute(hookType: HookType | string, data: any = {}): Promise<HookResult> {
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

  // Execute hooks synchronously (for simple cases)
  executeSync(hookType: HookType | string, data: any = {}): any[] {
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

  // Add middleware
  addMiddleware(middleware: HookMiddleware): void {
    this.middleware.push(middleware);
    
    this.emit('middleware-added', { name: middleware.name });

    if (this.debugMode) {
      console.log(chalk.green(`[Hook] Added middleware: ${middleware.name}`));
    }
  }

  // Remove middleware
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

  // Get registered hooks
  getHooks(hookType?: HookType | string): Map<HookType, HookHandler[]> | HookHandler[] {
    if (hookType) {
      return this.hooks.get(hookType as HookType) || [];
    }
    return new Map(this.hooks);
  }

  // Get hooks for a specific plugin
  getPluginHooks(pluginName: string): HookHandler[] {
    const pluginHooks: HookHandler[] = [];
    
    for (const handlers of this.hooks.values()) {
      pluginHooks.push(...handlers.filter(h => h.pluginName === pluginName));
    }

    return pluginHooks;
  }

  // Get hook statistics
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

  // Enable/disable hook system
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.emit('system-toggled', { enabled });
  }

  // Set debug mode
  setDebugMode(debug: boolean): void {
    this.debugMode = debug;
    this.emit('debug-toggled', { debug });
  }

  // Clear all hooks
  clear(): void {
    this.hooks.clear();
    this.executionStats.clear();
    this.initializeBuiltinHooks();
    this.emit('system-cleared');
  }

  // Create a scoped hook system for a plugin
  createPluginScope(pluginName: string): PluginHookAPI {
    return new PluginHookAPI(this, pluginName);
  }
}

// Plugin-scoped hook API
export class PluginHookAPI {
  constructor(
    private hookSystem: PluginHookSystem,
    private pluginName: string
  ) {}

  // Register a hook (automatically includes plugin name)
  register(
    hookType: HookType | string,
    handler: (...args: any[]) => any,
    options?: HookRegistrationOptions
  ): string {
    return this.hookSystem.register(hookType, handler, this.pluginName, options);
  }

  // Unregister a hook
  unregister(hookType: HookType | string, handlerId: string): boolean {
    return this.hookSystem.unregister(hookType, handlerId);
  }

  // Execute hooks
  async execute(hookType: HookType | string, data?: any): Promise<HookResult> {
    return this.hookSystem.execute(hookType, data);
  }

  // Execute hooks synchronously
  executeSync(hookType: HookType | string, data?: any): any[] {
    return this.hookSystem.executeSync(hookType, data);
  }

  // Get plugin's hooks
  getHooks(): HookHandler[] {
    return this.hookSystem.getPluginHooks(this.pluginName);
  }

  // Register a custom hook type
  registerCustomHook(name: string): string {
    const customHookType = `${this.pluginName}:${name}`;
    return customHookType;
  }

  // Convenience methods for common hooks
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

// Utility functions
export function createHookSystem(options?: { debugMode?: boolean }): PluginHookSystem {
  return new PluginHookSystem(options);
}

export function isValidHookType(hookType: string): boolean {
  return Object.values(HookType).includes(hookType as HookType);
}

export { HookType as BuiltinHooks };