import * as path from 'path';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { Command } from 'commander';
import { ValidationError } from './error-handler';
import { PluginManifest, PluginRegistration } from './plugin-system';
import { createMiddlewareChainManager, MiddlewareType } from './plugin-command-middleware';
import { createConflictResolver, CommandConflictResolver } from './plugin-command-conflicts';

// Command definition from plugin
export interface PluginCommandDefinition {
  name: string;
  description: string;
  aliases?: string[];
  arguments?: PluginCommandArgument[];
  options?: PluginCommandOption[];
  subcommands?: PluginCommandDefinition[];
  handler: PluginCommandHandler;
  middleware?: PluginCommandMiddleware[];
  priority?: number;
  category?: string;
  examples?: string[];
  hidden?: boolean;
  deprecated?: boolean;
  permission?: string;
}

// Command argument definition
export interface PluginCommandArgument {
  name: string;
  description: string;
  required: boolean;
  variadic?: boolean;
  type?: 'string' | 'number' | 'boolean';
  choices?: string[];
  defaultValue?: any;
  validation?: PluginArgumentValidator;
}

// Command option definition
export interface PluginCommandOption {
  flag: string;
  description: string;
  type?: 'string' | 'number' | 'boolean';
  required?: boolean;
  choices?: string[];
  defaultValue?: any;
  validation?: PluginArgumentValidator;
  conflicts?: string[];
  implies?: string[];
}

// Command handler function
export type PluginCommandHandler = (
  args: Record<string, any>,
  options: Record<string, any>,
  context: PluginCommandContext
) => Promise<void> | void;

// Command middleware function
export type PluginCommandMiddleware = (
  args: Record<string, any>,
  options: Record<string, any>,
  context: PluginCommandContext,
  next: () => Promise<void>
) => Promise<void>;

// Argument validator function
export type PluginArgumentValidator = (value: any) => boolean | string;

// Command execution context
export interface PluginCommandContext {
  command: PluginCommandDefinition;
  plugin: PluginRegistration;
  cli: {
    program: Command;
    rootPath: string;
    configPath: string;
    version: string;
  };
  logger: {
    debug: (msg: string, ...args: any[]) => void;
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
  };
  utils: {
    path: typeof path;
    chalk: typeof chalk;
    spinner: any;
  };
}

// Registered command information
export interface RegisteredCommand {
  id: string;
  pluginName: string;
  definition: PluginCommandDefinition;
  commanderCommand: Command;
  registeredAt: number;
  usageCount: number;
  lastUsed?: number;
  isActive: boolean;
  conflicts: string[];
}

// Command registration result
export interface CommandRegistrationResult {
  success: boolean;
  commandId: string;
  conflicts: string[];
  warnings: string[];
  errors: string[];
}

// Command registry configuration
export interface CommandRegistryConfig {
  allowConflicts: boolean;
  conflictResolution: 'first' | 'last' | 'priority' | 'manual';
  enableMiddleware: boolean;
  validatePermissions: boolean;
  trackUsage: boolean;
  logCommands: boolean;
}

// Plugin command registry
export class PluginCommandRegistry extends EventEmitter {
  private commands: Map<string, RegisteredCommand> = new Map();
  private aliases: Map<string, string> = new Map(); // alias -> commandId
  private conflicts: Map<string, string[]> = new Map(); // commandName -> conflicting commandIds
  private program: Command;
  private config: CommandRegistryConfig;
  private isInitialized = false;
  private middlewareManager = createMiddlewareChainManager();
  private conflictResolver = createConflictResolver();

  constructor(program: Command, config: Partial<CommandRegistryConfig> = {}) {
    super();
    this.program = program;
    this.config = {
      allowConflicts: false,
      conflictResolution: 'priority',
      enableMiddleware: true,
      validatePermissions: true,
      trackUsage: true,
      logCommands: true,
      ...config
    };
  }

  // Initialize the command registry
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.emit('registry-initializing');
    
    try {
      // Setup command tracking
      if (this.config.trackUsage) {
        this.setupUsageTracking();
      }

      this.isInitialized = true;
      this.emit('registry-initialized');
      
    } catch (error) {
      this.emit('registry-error', error);
      throw error;
    }
  }

  // Register a command from a plugin
  async registerCommand(
    plugin: PluginRegistration,
    definition: PluginCommandDefinition
  ): Promise<CommandRegistrationResult> {
    if (!this.isInitialized) {
      throw new ValidationError('Command registry not initialized');
    }

    const commandId = this.generateCommandId(plugin.manifest.name, definition.name);
    
    this.emit('command-registering', { pluginName: plugin.manifest.name, definition });

    try {
      // Validate command definition
      this.validateCommandDefinition(definition);

      // Check for conflicts
      const conflicts = this.checkForConflicts(definition);
      
      if (conflicts.length > 0 && !this.config.allowConflicts) {
        // Try auto-resolution if enabled
        if (this.config.conflictResolution === 'priority') {
          try {
            // Update conflict resolver with current commands
            this.conflictResolver.registerCommands(Array.from(this.commands.values()));
            await this.conflictResolver.autoResolveConflicts();
          } catch (error) {
            // Auto-resolution failed, report conflict
            const result: CommandRegistrationResult = {
              success: false,
              commandId,
              conflicts,
              warnings: [],
              errors: [`Command conflicts detected: ${conflicts.join(', ')}`]
            };
            
            this.emit('command-registration-failed', result);
            return result;
          }
        } else {
          const result: CommandRegistrationResult = {
            success: false,
            commandId,
            conflicts,
            warnings: [],
            errors: [`Command conflicts detected: ${conflicts.join(', ')}`]
          };
          
          this.emit('command-registration-failed', result);
          return result;
        }
      }

      // Create Commander command
      const commanderCommand = this.createCommanderCommand(plugin, definition);
      
      // Register command
      const registeredCommand: RegisteredCommand = {
        id: commandId,
        pluginName: plugin.manifest.name,
        definition,
        commanderCommand,
        registeredAt: Date.now(),
        usageCount: 0,
        isActive: true,
        conflicts
      };

      this.commands.set(commandId, registeredCommand);

      // Register aliases
      if (definition.aliases) {
        definition.aliases.forEach(alias => {
          this.aliases.set(alias, commandId);
        });
      }

      // Update conflict tracking
      if (conflicts.length > 0) {
        this.updateConflictTracking(definition.name, commandId);
      }

      const result: CommandRegistrationResult = {
        success: true,
        commandId,
        conflicts,
        warnings: conflicts.length > 0 ? [`Command has conflicts: ${conflicts.join(', ')}`] : [],
        errors: []
      };

      this.emit('command-registered', {
        pluginName: plugin.manifest.name,
        commandId,
        definition,
        result
      });

      return result;

    } catch (error) {
      const result: CommandRegistrationResult = {
        success: false,
        commandId,
        conflicts: [],
        warnings: [],
        errors: [error instanceof Error ? error.message : String(error)]
      };

      this.emit('command-registration-failed', result);
      return result;
    }
  }

  // Unregister a command
  async unregisterCommand(commandId: string): Promise<boolean> {
    const command = this.commands.get(commandId);
    if (!command) {
      return false;
    }

    this.emit('command-unregistering', { commandId, command });

    try {
      // Remove from Commander
      const parent = command.commanderCommand.parent;
      if (parent) {
        // Remove from parent's commands (cast to any to access internal properties)
        const parentAny = parent as any;
        if (parentAny.commands && Array.isArray(parentAny.commands)) {
          const index = parentAny.commands.indexOf(command.commanderCommand);
          if (index !== -1) {
            parentAny.commands.splice(index, 1);
          }
        }
      }

      // Remove aliases
      if (command.definition.aliases) {
        command.definition.aliases.forEach(alias => {
          this.aliases.delete(alias);
        });
      }

      // Remove from conflicts
      this.removeFromConflictTracking(command.definition.name, commandId);

      // Remove command
      this.commands.delete(commandId);

      this.emit('command-unregistered', { commandId, command });
      return true;

    } catch (error) {
      this.emit('command-unregistration-failed', { commandId, error });
      return false;
    }
  }

  // Unregister all commands from a plugin
  async unregisterPluginCommands(pluginName: string): Promise<number> {
    const pluginCommands = Array.from(this.commands.values())
      .filter(cmd => cmd.pluginName === pluginName);

    let unregisteredCount = 0;
    
    for (const command of pluginCommands) {
      const success = await this.unregisterCommand(command.id);
      if (success) {
        unregisteredCount++;
      }
    }

    this.emit('plugin-commands-unregistered', { pluginName, count: unregisteredCount });
    return unregisteredCount;
  }

  // Get registered command by ID
  getCommand(commandId: string): RegisteredCommand | undefined {
    return this.commands.get(commandId);
  }

  // Get all registered commands
  getCommands(): RegisteredCommand[] {
    return Array.from(this.commands.values());
  }

  // Get commands by plugin
  getPluginCommands(pluginName: string): RegisteredCommand[] {
    return Array.from(this.commands.values())
      .filter(cmd => cmd.pluginName === pluginName);
  }

  // Get command by name or alias
  findCommand(nameOrAlias: string): RegisteredCommand | undefined {
    // Check direct command names
    for (const command of this.commands.values()) {
      if (command.definition.name === nameOrAlias) {
        return command;
      }
    }

    // Check aliases
    const commandId = this.aliases.get(nameOrAlias);
    if (commandId) {
      return this.commands.get(commandId);
    }

    return undefined;
  }

  // List all conflicts
  getConflicts(): Map<string, string[]> {
    return new Map(this.conflicts);
  }

  // Resolve command conflicts
  async resolveConflicts(commandName: string, resolution: 'disable' | 'priority'): Promise<boolean> {
    const conflictingIds = this.conflicts.get(commandName);
    if (!conflictingIds || conflictingIds.length <= 1) {
      return false;
    }

    this.emit('conflict-resolving', { commandName, conflictingIds, resolution });

    try {
      if (resolution === 'disable') {
        // Disable all but the first command
        for (let i = 1; i < conflictingIds.length; i++) {
          const command = this.commands.get(conflictingIds[i]);
          if (command) {
            command.isActive = false;
            (command.commanderCommand as any).hidden = true;
          }
        }
      } else if (resolution === 'priority') {
        // Sort by priority and disable lower priority commands
        const commands = conflictingIds
          .map(id => this.commands.get(id))
          .filter(cmd => cmd !== undefined)
          .sort((a, b) => (b!.definition.priority || 0) - (a!.definition.priority || 0));

        for (let i = 1; i < commands.length; i++) {
          commands[i]!.isActive = false;
          (commands[i]!.commanderCommand as any).hidden = true;
        }
      }

      this.emit('conflict-resolved', { commandName, conflictingIds, resolution });
      return true;

    } catch (error) {
      this.emit('conflict-resolution-failed', { commandName, conflictingIds, resolution, error });
      return false;
    }
  }

  // Validate command definition
  private validateCommandDefinition(definition: PluginCommandDefinition): void {
    if (!definition.name || typeof definition.name !== 'string') {
      throw new ValidationError('Command name is required and must be a string');
    }

    if (!definition.description || typeof definition.description !== 'string') {
      throw new ValidationError('Command description is required and must be a string');
    }

    if (definition.name.includes(' ')) {
      throw new ValidationError('Command name cannot contain spaces');
    }

    if (!/^[a-z][a-z0-9-]*$/.test(definition.name)) {
      throw new ValidationError('Command name must be lowercase and contain only letters, numbers, and hyphens');
    }

    if (typeof definition.handler !== 'function') {
      throw new ValidationError('Command handler must be a function');
    }

    // Validate arguments
    if (definition.arguments) {
      definition.arguments.forEach((arg, index) => {
        if (!arg.name || typeof arg.name !== 'string') {
          throw new ValidationError(`Argument ${index} name is required and must be a string`);
        }
        if (typeof arg.required !== 'boolean') {
          throw new ValidationError(`Argument ${index} required property must be a boolean`);
        }
      });
    }

    // Validate options
    if (definition.options) {
      definition.options.forEach((opt, index) => {
        if (!opt.flag || typeof opt.flag !== 'string') {
          throw new ValidationError(`Option ${index} flag is required and must be a string`);
        }
        if (!opt.flag.startsWith('-')) {
          throw new ValidationError(`Option ${index} flag must start with '-'`);
        }
      });
    }
  }

  // Check for command conflicts
  private checkForConflicts(definition: PluginCommandDefinition): string[] {
    const conflicts: string[] = [];

    // Check command name conflicts
    const existingCommand = this.findCommand(definition.name);
    if (existingCommand) {
      conflicts.push(existingCommand.id);
    }

    // Check alias conflicts
    if (definition.aliases) {
      definition.aliases.forEach(alias => {
        const existingCommand = this.findCommand(alias);
        if (existingCommand && !conflicts.includes(existingCommand.id)) {
          conflicts.push(existingCommand.id);
        }
      });
    }

    return conflicts;
  }

  // Create Commander command from definition
  private createCommanderCommand(
    plugin: PluginRegistration,
    definition: PluginCommandDefinition
  ): Command {
    const command = new Command(definition.name);
    command.description(definition.description);

    // Add aliases
    if (definition.aliases) {
      definition.aliases.forEach(alias => {
        command.alias(alias);
      });
    }

    // Add arguments
    if (definition.arguments) {
      definition.arguments.forEach(arg => {
        const argString = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
        command.argument(argString, arg.description, arg.defaultValue);
      });
    }

    // Add options
    if (definition.options) {
      definition.options.forEach(opt => {
        command.option(opt.flag, opt.description, opt.defaultValue);
      });
    }

    // Set action handler
    command.action(async (...args) => {
      const commandArgs = args.slice(0, -1); // Remove options object
      const options = args[args.length - 1]; // Last argument is options

      // Track usage
      if (this.config.trackUsage) {
        this.trackCommandUsage(this.generateCommandId(plugin.manifest.name, definition.name));
      }

      // Create context
      const context = this.createCommandContext(plugin, definition);

      let processedArgs: Record<string, any> = {};
      let processedOptions: Record<string, any> = {};

      try {
        // Process arguments
        processedArgs = this.processArguments(definition, commandArgs);
        processedOptions = this.processOptions(definition, options);

        // Execute middleware chain
        if (this.config.enableMiddleware) {
          // Execute pre-validation middleware
          await this.middlewareManager.executeChain(
            MiddlewareType.PRE_VALIDATION,
            processedArgs,
            processedOptions,
            context
          );

          // Execute validation middleware
          await this.middlewareManager.executeChain(
            MiddlewareType.VALIDATION,
            processedArgs,
            processedOptions,
            context
          );

          // Execute authorization middleware
          await this.middlewareManager.executeChain(
            MiddlewareType.AUTHORIZATION,
            processedArgs,
            processedOptions,
            context
          );

          // Execute pre-execution middleware
          await this.middlewareManager.executeChain(
            MiddlewareType.PRE_EXECUTION,
            processedArgs,
            processedOptions,
            context
          );

          // Execute command-specific middleware
          if (definition.middleware) {
            for (const middleware of definition.middleware) {
              await new Promise<void>((resolve) => {
                middleware(processedArgs, processedOptions, context, async () => {
                  resolve();
                });
              });
            }
          }
        }

        // Execute command handler
        await definition.handler(processedArgs, processedOptions, context);

        // Execute post-execution middleware
        if (this.config.enableMiddleware) {
          await this.middlewareManager.executeChain(
            MiddlewareType.POST_EXECUTION,
            processedArgs,
            processedOptions,
            context
          );

          // Execute logging middleware
          await this.middlewareManager.executeChain(
            MiddlewareType.LOGGER,
            processedArgs,
            processedOptions,
            context
          );
        }

      } catch (error) {
        // Execute error handling middleware
        if (this.config.enableMiddleware && processedArgs && processedOptions) {
          try {
            await this.middlewareManager.executeChain(
              MiddlewareType.ERROR_HANDLER,
              processedArgs,
              processedOptions,
              context
            );
          } catch (middlewareError) {
            // Log middleware error but continue with original error
            context.logger.error(`Error handling middleware failed: ${middlewareError instanceof Error ? middlewareError.message : String(middlewareError)}`);
          }
        }

        this.emit('command-execution-error', {
          pluginName: plugin.manifest.name,
          commandName: definition.name,
          error
        });

        context.logger.error(`Command execution failed: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    });

    // Hide if deprecated or hidden
    if (definition.hidden || definition.deprecated) {
      (command as any).hidden = true;
    }

    // Add to parent program
    this.program.addCommand(command);

    return command;
  }

  // Process command arguments
  private processArguments(definition: PluginCommandDefinition, args: any[]): Record<string, any> {
    const processed: Record<string, any> = {};

    if (definition.arguments) {
      definition.arguments.forEach((argDef, index) => {
        const value = args[index];
        
        if (argDef.required && (value === undefined || value === null)) {
          throw new ValidationError(`Required argument '${argDef.name}' is missing`);
        }

        if (value !== undefined) {
          // Type conversion
          let convertedValue = value;
          if (argDef.type === 'number') {
            convertedValue = Number(value);
            if (isNaN(convertedValue)) {
              throw new ValidationError(`Argument '${argDef.name}' must be a number`);
            }
          } else if (argDef.type === 'boolean') {
            convertedValue = Boolean(value);
          }

          // Choice validation
          if (argDef.choices && !argDef.choices.includes(convertedValue)) {
            throw new ValidationError(`Argument '${argDef.name}' must be one of: ${argDef.choices.join(', ')}`);
          }

          // Custom validation
          if (argDef.validation) {
            const validationResult = argDef.validation(convertedValue);
            if (validationResult !== true) {
              const errorMsg = typeof validationResult === 'string' 
                ? validationResult 
                : `Argument '${argDef.name}' is invalid`;
              throw new ValidationError(errorMsg);
            }
          }

          processed[argDef.name] = convertedValue;
        } else if (argDef.defaultValue !== undefined) {
          processed[argDef.name] = argDef.defaultValue;
        }
      });
    }

    return processed;
  }

  // Process command options
  private processOptions(definition: PluginCommandDefinition, options: Record<string, any>): Record<string, any> {
    const processed: Record<string, any> = { ...options };

    if (definition.options) {
      definition.options.forEach(optDef => {
        const flagName = this.extractOptionName(optDef.flag);
        const value = options[flagName];

        if (optDef.required && (value === undefined || value === null)) {
          throw new ValidationError(`Required option '${optDef.flag}' is missing`);
        }

        if (value !== undefined) {
          // Type conversion
          let convertedValue = value;
          if (optDef.type === 'number') {
            convertedValue = Number(value);
            if (isNaN(convertedValue)) {
              throw new ValidationError(`Option '${optDef.flag}' must be a number`);
            }
          } else if (optDef.type === 'boolean') {
            convertedValue = Boolean(value);
          }

          // Choice validation
          if (optDef.choices && !optDef.choices.includes(convertedValue)) {
            throw new ValidationError(`Option '${optDef.flag}' must be one of: ${optDef.choices.join(', ')}`);
          }

          // Custom validation
          if (optDef.validation) {
            const validationResult = optDef.validation(convertedValue);
            if (validationResult !== true) {
              const errorMsg = typeof validationResult === 'string' 
                ? validationResult 
                : `Option '${optDef.flag}' is invalid`;
              throw new ValidationError(errorMsg);
            }
          }

          processed[flagName] = convertedValue;
        }
      });

      // Check option conflicts and implications
      this.validateOptionRelationships(definition.options, processed);
    }

    return processed;
  }

  // Validate option conflicts and implications
  private validateOptionRelationships(
    options: PluginCommandOption[], 
    processedOptions: Record<string, any>
  ): void {
    for (const option of options) {
      const flagName = this.extractOptionName(option.flag);
      
      if (processedOptions[flagName] !== undefined) {
        // Check conflicts
        if (option.conflicts) {
          for (const conflictFlag of option.conflicts) {
            const conflictName = this.extractOptionName(conflictFlag);
            if (processedOptions[conflictName] !== undefined) {
              throw new ValidationError(`Option '${option.flag}' conflicts with '${conflictFlag}'`);
            }
          }
        }

        // Check implications
        if (option.implies) {
          for (const impliedFlag of option.implies) {
            const impliedName = this.extractOptionName(impliedFlag);
            if (processedOptions[impliedName] === undefined) {
              throw new ValidationError(`Option '${option.flag}' requires '${impliedFlag}' to be specified`);
            }
          }
        }
      }
    }
  }

  // Get middleware manager
  getMiddlewareManager() {
    return this.middlewareManager;
  }

  // Get conflict resolver
  getConflictResolver() {
    return this.conflictResolver;
  }

  // Update conflict resolver with current commands
  updateConflictResolver(): void {
    this.conflictResolver.registerCommands(Array.from(this.commands.values()));
  }

  // Create command execution context
  private createCommandContext(
    plugin: PluginRegistration,
    definition: PluginCommandDefinition
  ): PluginCommandContext {
    return {
      command: definition,
      plugin,
      cli: {
        program: this.program,
        rootPath: process.cwd(),
        configPath: path.join(process.cwd(), '.re-shell'),
        version: '0.7.0' // Would get from package.json
      },
      logger: this.createLogger(plugin.manifest.name, definition.name),
      utils: {
        path,
        chalk,
        spinner: null // Would inject spinner utility
      }
    };
  }

  // Create command logger
  private createLogger(pluginName: string, commandName: string): any {
    const prefix = `[${pluginName}:${commandName}]`;
    return {
      debug: (msg: string, ...args: any[]) => console.debug(chalk.gray(`${prefix} ${msg}`), ...args),
      info: (msg: string, ...args: any[]) => console.info(chalk.blue(`${prefix} ${msg}`), ...args),
      warn: (msg: string, ...args: any[]) => console.warn(chalk.yellow(`${prefix} ${msg}`), ...args),
      error: (msg: string, ...args: any[]) => console.error(chalk.red(`${prefix} ${msg}`), ...args)
    };
  }

  // Extract option name from flag
  private extractOptionName(flag: string): string {
    const match = flag.match(/--?([a-zA-Z][a-zA-Z0-9-]*)/);
    return match ? match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) : flag;
  }

  // Generate unique command ID
  private generateCommandId(pluginName: string, commandName: string): string {
    return `${pluginName}:${commandName}`;
  }

  // Setup usage tracking
  private setupUsageTracking(): void {
    // Would implement persistent usage tracking
  }

  // Track command usage
  private trackCommandUsage(commandId: string): void {
    const command = this.commands.get(commandId);
    if (command) {
      command.usageCount++;
      command.lastUsed = Date.now();
    }
  }

  // Update conflict tracking
  private updateConflictTracking(commandName: string, commandId: string): void {
    if (!this.conflicts.has(commandName)) {
      this.conflicts.set(commandName, []);
    }
    this.conflicts.get(commandName)!.push(commandId);
  }

  // Remove from conflict tracking
  private removeFromConflictTracking(commandName: string, commandId: string): void {
    const conflicts = this.conflicts.get(commandName);
    if (conflicts) {
      const index = conflicts.indexOf(commandId);
      if (index !== -1) {
        conflicts.splice(index, 1);
        if (conflicts.length === 0) {
          this.conflicts.delete(commandName);
        }
      }
    }
  }

  // Get registry statistics
  getStats(): any {
    const stats = {
      totalCommands: this.commands.size,
      activeCommands: Array.from(this.commands.values()).filter(cmd => cmd.isActive).length,
      totalAliases: this.aliases.size,
      totalConflicts: this.conflicts.size,
      commandsByPlugin: {} as Record<string, number>,
      mostUsedCommands: [] as Array<{ id: string; name: string; plugin: string; usageCount: number }>,
      recentCommands: [] as Array<{ id: string; name: string; plugin: string; lastUsed: number }>
    };

    // Commands by plugin
    for (const command of this.commands.values()) {
      stats.commandsByPlugin[command.pluginName] = (stats.commandsByPlugin[command.pluginName] || 0) + 1;
    }

    // Most used commands
    stats.mostUsedCommands = Array.from(this.commands.values())
      .filter(cmd => cmd.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10)
      .map(cmd => ({
        id: cmd.id,
        name: cmd.definition.name,
        plugin: cmd.pluginName,
        usageCount: cmd.usageCount
      }));

    // Recent commands
    stats.recentCommands = Array.from(this.commands.values())
      .filter(cmd => cmd.lastUsed)
      .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
      .slice(0, 10)
      .map(cmd => ({
        id: cmd.id,
        name: cmd.definition.name,
        plugin: cmd.pluginName,
        lastUsed: cmd.lastUsed || 0
      }));

    return stats;
  }
}

// Utility functions
export function createPluginCommandRegistry(
  program: Command,
  config?: Partial<CommandRegistryConfig>
): PluginCommandRegistry {
  return new PluginCommandRegistry(program, config);
}

export function validateCommandName(name: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(name) && !name.includes('  ');
}

export function normalizeCommandName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
}