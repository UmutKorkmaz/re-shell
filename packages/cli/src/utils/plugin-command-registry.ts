import * as path from 'path';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { Command } from 'commander';
import { ValidationError } from './error-handler';
import { PluginRegistration } from './plugin-system';
import { createMiddlewareChainManager, MiddlewareType } from './plugin-command-middleware';
import { createConflictResolver} from './plugin-command-conflicts';

/**
 * Represents a complete command definition provided by a plugin.
 * This interface describes all aspects of a command including its name,
 * arguments, options, handler, middleware, and metadata.
 */
export interface PluginCommandDefinition {
  /** The unique name of the command, must be lowercase with letters, numbers, and hyphens. */
  name: string;
  /** A human-readable description of what the command does. */
  description: string;
  /** Optional alternative names that can be used to invoke the command. */
  aliases?: string[];
  /** Optional list of positional arguments accepted by the command. */
  arguments?: PluginCommandArgument[];
  /** Optional list of flags/options accepted by the command. */
  options?: PluginCommandOption[];
  /** Optional nested subcommands under this command. */
  subcommands?: PluginCommandDefinition[];
  /** The handler function executed when the command is invoked. */
  handler: PluginCommandHandler;
  /** Optional command-specific middleware executed before the handler. */
  middleware?: PluginCommandMiddleware[];
  /** Optional priority value used for conflict resolution (higher wins). */
  priority?: number;
  /** Optional category label for grouping commands in help output. */
  category?: string;
  /** Optional example usage strings shown in help text. */
  examples?: string[];
  /** Whether the command should be hidden from help output. */
  hidden?: boolean;
  /** Whether the command is deprecated and may be removed in future versions. */
  deprecated?: boolean;
  /** Optional permission identifier required to execute the command. */
  permission?: string;
}

/**
 * Defines a single positional argument for a plugin command.
 */
export interface PluginCommandArgument {
  /** The name of the argument as displayed in help output. */
  name: string;
  /** A description of what the argument represents. */
  description: string;
  /** Whether the argument must be provided by the user. */
  required: boolean;
  /** Whether the argument accepts multiple values (e.g. variadic args). */
  variadic?: boolean;
  /** The expected data type of the argument value. */
  type?: 'string' | 'number' | 'boolean';
  /** Optional list of allowed values for the argument. */
  choices?: string[];
  /** Optional default value used when the argument is not supplied. */
  defaultValue?: any;
  /** Optional custom validation function for the argument value. */
  validation?: PluginArgumentValidator;
}

/**
 * Defines a single option (flag) for a plugin command.
 */
export interface PluginCommandOption {
  /** The flag string, e.g. `-v` or `--verbose`. */
  flag: string;
  /** A description of what the option does. */
  description: string;
  /** The expected data type of the option value. */
  type?: 'string' | 'number' | 'boolean';
  /** Whether the option must be provided by the user. */
  required?: boolean;
  /** Optional list of allowed values for the option. */
  choices?: string[];
  /** Optional default value used when the option is not supplied. */
  defaultValue?: any;
  /** Optional custom validation function for the option value. */
  validation?: PluginArgumentValidator;
  /** Optional list of other flags that cannot be used together with this option. */
  conflicts?: string[];
  /** Optional list of other flags that must be present when this option is used. */
  implies?: string[];
}

/**
 * Function signature for a plugin command handler.
 *
 * @param args - The processed positional arguments keyed by argument name.
 * @param options - The processed options keyed by option flag name.
 * @param context - The execution context providing CLI utilities and plugin info.
 * @returns A promise that resolves when the handler completes, or void.
 */
export type PluginCommandHandler = (
  args: Record<string, any>,
  options: Record<string, any>,
  context: PluginCommandContext
) => Promise<void> | void;

/**
 * Function signature for command-specific middleware that wraps the handler call.
 *
 * @param args - The processed positional arguments keyed by argument name.
 * @param options - The processed options keyed by option flag name.
 * @param context - The execution context providing CLI utilities and plugin info.
 * @param next - Callback to continue to the next middleware or the handler.
 * @returns A promise that resolves when the middleware logic completes.
 */
export type PluginCommandMiddleware = (
  args: Record<string, any>,
  options: Record<string, any>,
  context: PluginCommandContext,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Function signature for a custom argument/option validator.
 *
 * @param value - The value to validate.
 * @returns `true` if valid, or an error message string if invalid.
 */
export type PluginArgumentValidator = (value: any) => boolean | string;

/**
 * Execution context passed to command handlers and middleware.
 * Provides access to the command definition, plugin info, CLI internals,
 * a logger, and shared utilities.
 */
export interface PluginCommandContext {
  /** The definition of the command currently being executed. */
  command: PluginCommandDefinition;
  /** The registration info of the plugin that owns this command. */
  plugin: PluginRegistration;
  /** CLI-level information and the Commander program instance. */
  cli: {
    /** The Commander program instance. */
    program: Command;
    /** The root working directory of the CLI. */
    rootPath: string;
    /** The path to the configuration file or directory. */
    configPath: string;
    /** The current CLI version string. */
    version: string;
  };
  /** A scoped logger with debug, info, warn, and error methods. */
  logger: {
    /** Log a debug-level message. */
    debug: (msg: string, ...args: any[]) => void;
    /** Log an info-level message. */
    info: (msg: string, ...args: any[]) => void;
    /** Log a warning-level message. */
    warn: (msg: string, ...args: any[]) => void;
    /** Log an error-level message. */
    error: (msg: string, ...args: any[]) => void;
  };
  /** Shared utility helpers available to all command handlers. */
  utils: {
    /** The Node.js path module. */
    path: typeof path;
    /** The chalk styling library. */
    chalk: typeof chalk;
    /** A spinner instance for progress indication (may be null). */
    spinner: any;
  };
}

/**
 * Represents a command that has been successfully registered in the registry.
 * Contains both the original definition and runtime metadata.
 */
export interface RegisteredCommand {
  /** The unique identifier for the command (pluginName:commandName). */
  id: string;
  /** The name of the plugin that registered the command. */
  pluginName: string;
  /** The original command definition provided by the plugin. */
  definition: PluginCommandDefinition;
  /** The underlying Commander Command instance. */
  commanderCommand: Command;
  /** Timestamp (ms) when the command was registered. */
  registeredAt: number;
  /** Number of times the command has been invoked. */
  usageCount: number;
  /** Timestamp (ms) of the last invocation, if any. */
  lastUsed?: number;
  /** Whether the command is currently active and visible. */
  isActive: boolean;
  /** List of command IDs that conflict with this command. */
  conflicts: string[];
}

/**
 * The result returned after attempting to register a command.
 */
export interface CommandRegistrationResult {
  /** Whether the registration succeeded. */
  success: boolean;
  /** The unique ID assigned to the command. */
  commandId: string;
  /** List of conflicting command IDs, if any. */
  conflicts: string[];
  /** Non-fatal warning messages produced during registration. */
  warnings: string[];
  /** Error messages produced when registration fails. */
  errors: string[];
}

/**
 * Configuration options for the plugin command registry.
 */
export interface CommandRegistryConfig {
  /** Whether commands with name conflicts are allowed to register. */
  allowConflicts: boolean;
  /** The strategy used to resolve conflicts between commands. */
  conflictResolution: 'first' | 'last' | 'priority' | 'manual';
  /** Whether the middleware pipeline is enabled for command execution. */
  enableMiddleware: boolean;
  /** Whether command permissions are validated before execution. */
  validatePermissions: boolean;
  /** Whether command usage (invocation count, timestamps) is tracked. */
  trackUsage: boolean;
  /** Whether executed commands are logged. */
  logCommands: boolean;
}

/**
 * Central registry for managing plugin-provided commands.
 * Handles registration, conflict resolution, middleware execution,
 * usage tracking, and integration with the Commander CLI program.
 */
export class PluginCommandRegistry extends EventEmitter {
  private commands: Map<string, RegisteredCommand> = new Map();
  private aliases: Map<string, string> = new Map(); // alias -> commandId
  private conflicts: Map<string, string[]> = new Map(); // commandName -> conflicting commandIds
  private program: Command;
  private config: CommandRegistryConfig;
  private isInitialized = false;
  private middlewareManager = createMiddlewareChainManager();
  private conflictResolver = createConflictResolver();

  /**
   * Creates a new PluginCommandRegistry instance.
   *
   * @param program - The Commander program instance to attach commands to.
   * @param config - Partial configuration; omitted values use sensible defaults.
   */
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

  /**
   * Initializes the registry, setting up usage tracking if enabled.
   * Emits `registry-initializing` and `registry-initialized` events.
   *
   * @returns A promise that resolves once initialization is complete.
   * @throws If an error occurs during initialization; emits `registry-error`.
   */
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

  /**
   * Registers a command from a plugin into the registry and the Commander program.
   * Validates the definition, checks for conflicts (optionally auto-resolving),
   * creates the Commander command, and emits lifecycle events.
   *
   * @param plugin - The registration info of the plugin providing the command.
   * @param definition - The full command definition.
   * @returns A result object indicating success, conflicts, warnings, and errors.
   */
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

  /**
   * Removes a command from the registry and detaches it from its Commander parent.
   *
   * @param commandId - The unique ID of the command to unregister.
   * @returns `true` if the command was found and removed; `false` otherwise.
   */
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
        // Remove from parent's commands (commands is readonly in types but mutable at runtime)
        const mutableParent = parent as Command & { commands: Command[] };
        if (mutableParent.commands && Array.isArray(mutableParent.commands)) {
          const index = mutableParent.commands.indexOf(command.commanderCommand);
          if (index !== -1) {
            mutableParent.commands.splice(index, 1);
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

  /**
   * Unregisters all commands belonging to a specific plugin.
   *
   * @param pluginName - The name of the plugin whose commands should be removed.
   * @returns The number of commands that were successfully unregistered.
   */
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

  /**
   * Retrieves a registered command by its unique ID.
   *
   * @param commandId - The unique ID of the command.
   * @returns The registered command, or `undefined` if not found.
   */
  getCommand(commandId: string): RegisteredCommand | undefined {
    return this.commands.get(commandId);
  }

  /**
   * Returns all commands currently registered in the registry.
   *
   * @returns An array of all registered commands.
   */
  getCommands(): RegisteredCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Returns all commands registered by a specific plugin.
   *
   * @param pluginName - The name of the plugin to filter by.
   * @returns An array of commands belonging to that plugin.
   */
  getPluginCommands(pluginName: string): RegisteredCommand[] {
    return Array.from(this.commands.values())
      .filter(cmd => cmd.pluginName === pluginName);
  }

  /**
   * Looks up a command by its name or one of its aliases.
   *
   * @param nameOrAlias - The command name or alias to search for.
   * @returns The matching registered command, or `undefined` if not found.
   */
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

  /**
   * Returns a copy of the current command-name-to-conflicting-IDs conflict map.
   *
   * @returns A map of command names to arrays of conflicting command IDs.
   */
  getConflicts(): Map<string, string[]> {
    return new Map(this.conflicts);
  }

  /**
   * Resolves conflicts for a given command name by disabling all but the
   * preferred command. Emits conflict resolution lifecycle events.
   *
   * @param commandName - The name of the command with conflicts to resolve.
   * @param resolution - The resolution strategy: `disable` keeps the first command,
   *   `priority` keeps the command with the highest priority value.
   * @returns `true` if conflicts were resolved; `false` if none existed or resolution failed.
   */
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
            (command.commanderCommand as { hidden?: boolean }).hidden = true;
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
          (commands[i]!.commanderCommand as { hidden?: boolean }).hidden = true;
        }
      }

      this.emit('conflict-resolved', { commandName, conflictingIds, resolution });
      return true;

    } catch (error) {
      this.emit('conflict-resolution-failed', { commandName, conflictingIds, resolution, error });
      return false;
    }
  }

  /**
   * Validates a command definition for correctness, ensuring required
   * fields are present and naming/argument/option rules are satisfied.
   *
   * @param definition - The command definition to validate.
   * @throws {ValidationError} If any validation rule is violated.
   */
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

  /**
   * Checks whether a command definition's name or aliases conflict with
   * any already-registered command.
   *
   * @param definition - The command definition to check.
   * @returns An array of conflicting command IDs.
   */
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

  /**
   * Creates a Commander Command instance from a plugin command definition,
   * wiring up aliases, arguments, options, the action handler, and the
   * full middleware execution pipeline.
   *
   * @param plugin - The plugin providing the command.
   * @param definition - The command definition to create from.
   * @returns The configured Commander Command instance.
   */
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
      (command as { hidden?: boolean }).hidden = true;
    }

    // Add to parent program
    this.program.addCommand(command);

    return command;
  }

  /**
   * Processes raw positional arguments from Commander, applying type
   * conversion, choice validation, and custom validators.
   *
   * @param definition - The command definition containing argument specs.
   * @param args - The raw positional arguments from Commander.
   * @returns A keyed object of processed argument values.
   * @throws {ValidationError} If a required argument is missing or validation fails.
   */
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

  /**
   * Processes raw options from Commander, applying type conversion,
   * choice validation, custom validators, and relationship checks.
   *
   * @param definition - The command definition containing option specs.
   * @param options - The raw options object from Commander.
   * @returns A processed options object.
   * @throws {ValidationError} If a required option is missing or validation fails.
   */
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

  /**
   * Validates that option conflicts (mutually exclusive) and implications
   * (required companions) are satisfied among the processed options.
   *
   * @param options - The option definitions from the command.
   * @param processedOptions - The resolved option values keyed by flag name.
   * @throws {ValidationError} If a conflict or implication rule is violated.
   */
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

  /**
   * Returns the middleware chain manager used by the registry.
   *
   * @returns The middleware chain manager instance.
   */
  getMiddlewareManager() {
    return this.middlewareManager;
  }

  /**
   * Returns the conflict resolver used by the registry.
   *
   * @returns The conflict resolver instance.
   */
  getConflictResolver() {
    return this.conflictResolver;
  }

  /**
   * Refreshes the conflict resolver's command data with all currently
   * registered commands.
   */
  updateConflictResolver(): void {
    this.conflictResolver.registerCommands(Array.from(this.commands.values()));
  }

  /**
   * Builds the execution context object passed to handlers and middleware.
   *
   * @param plugin - The plugin providing the command.
   * @param definition - The command definition.
   * @returns The fully constructed execution context.
   */
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

  /**
   * Creates a scoped logger instance prefixed with the plugin and command name.
   *
   * @param pluginName - The name of the plugin owning the command.
   * @param commandName - The name of the command.
   * @returns A logger object with debug, info, warn, and error methods.
   */
  private createLogger(pluginName: string, commandName: string): any {
    const prefix = `[${pluginName}:${commandName}]`;
    return {
      debug: (msg: string, ...args: any[]) => console.debug(chalk.gray(`${prefix} ${msg}`), ...args),
      info: (msg: string, ...args: any[]) => console.info(chalk.blue(`${prefix} ${msg}`), ...args),
      warn: (msg: string, ...args: any[]) => console.warn(chalk.yellow(`${prefix} ${msg}`), ...args),
      error: (msg: string, ...args: any[]) => console.error(chalk.red(`${prefix} ${msg}`), ...args)
    };
  }

  /**
   * Extracts the camelCase option name from a CLI flag string.
   * For example, `--output-dir` becomes `outputDir`.
   *
   * @param flag - The flag string (e.g. `-v`, `--verbose`, `--output-dir`).
   * @returns The extracted camelCase name, or the original flag if no match.
   */
  private extractOptionName(flag: string): string {
    const match = flag.match(/--?([a-zA-Z][a-zA-Z0-9-]*)/);
    return match ? match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) : flag;
  }

  /**
   * Generates a unique command ID from the plugin name and command name.
   *
   * @param pluginName - The name of the plugin.
   * @param commandName - The name of the command.
   * @returns The unique command ID in the format `pluginName:commandName`.
   */
  private generateCommandId(pluginName: string, commandName: string): string {
    return `${pluginName}:${commandName}`;
  }

  /**
   * Sets up persistent usage tracking for registered commands.
   * Intended to be overridden or extended for persistent storage.
   */
  private setupUsageTracking(): void {
    // Would implement persistent usage tracking
  }

  /**
   * Increments the usage count and updates the last-used timestamp for a command.
   *
   * @param commandId - The unique ID of the command that was invoked.
   */
  private trackCommandUsage(commandId: string): void {
    const command = this.commands.get(commandId);
    if (command) {
      command.usageCount++;
      command.lastUsed = Date.now();
    }
  }

  /**
   * Adds a command ID to the conflict list for a given command name.
   *
   * @param commandName - The name of the command with conflicts.
   * @param commandId - The ID of the conflicting command to add.
   */
  private updateConflictTracking(commandName: string, commandId: string): void {
    if (!this.conflicts.has(commandName)) {
      this.conflicts.set(commandName, []);
    }
    this.conflicts.get(commandName)!.push(commandId);
  }

  /**
   * Removes a command ID from the conflict list for a given command name,
   * cleaning up the entry entirely when no conflicts remain.
   *
   * @param commandName - The name of the command with conflicts.
   * @param commandId - The ID of the command to remove from the conflict list.
   */
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

  /**
   * Computes summary statistics about the registry, including total/active
   * command counts, aliases, conflicts, per-plugin breakdowns, most used
   * commands, and recently used commands.
   *
   * @returns A statistics object describing the current registry state.
   */
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

/**
 * Creates and returns a new PluginCommandRegistry instance with the given
 * Commander program and optional configuration.
 *
 * @param program - The Commander program instance to attach commands to.
 * @param config - Optional partial configuration for the registry.
 * @returns A new PluginCommandRegistry instance.
 */
export function createPluginCommandRegistry(
  program: Command,
  config?: Partial<CommandRegistryConfig>
): PluginCommandRegistry {
  return new PluginCommandRegistry(program, config);
}

/**
 * Validates that a command name follows naming conventions: lowercase
 * letters, numbers, and hyphens only, starting with a letter, and no
 * consecutive double spaces.
 *
 * @param name - The command name to validate.
 * @returns `true` if the name is valid; `false` otherwise.
 */
export function validateCommandName(name: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(name) && !name.includes('  ');
}

/**
 * Normalizes a command name by converting to lowercase, replacing any
 * non-alphanumeric/hyphen characters with hyphens, and collapsing
 * consecutive hyphens into a single one.
 *
 * @param name - The raw command name to normalize.
 * @returns The normalized command name.
 */
export function normalizeCommandName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
}