import { Command } from 'commander';
import { EventEmitter } from 'events';
import * as path from 'path';
import chalk from 'chalk';
import { PluginHookAPI } from '../utils/plugin-hooks';
import { ValidationError } from '../utils/error-handler';

export interface CommandDefinition {
  name: string;
  description: string;
  alias?: string[];
  options?: CommandOption[];
  arguments?: CommandArgument[];
  examples?: CommandExample[];
  keywords?: string[];
  category?: string;
  priority?: number;
  hidden?: boolean;
  experimental?: boolean;
  middleware?: CommandMiddleware[];
  handler: CommandHandler;
  plugin?: {
    name: string;
    version: string;
  };
}

export interface CommandOption {
  flag: string;
  description: string;
  defaultValue?: any;
  required?: boolean;
  choices?: string[];
  validator?: (value: any) => boolean | Promise<boolean>;
  transformer?: (value: any) => any;
}

export interface CommandArgument {
  name: string;
  description: string;
  required?: boolean;
  variadic?: boolean;
  defaultValue?: any;
  validator?: (value: any) => boolean | Promise<boolean>;
  transformer?: (value: any) => any;
}

export interface CommandExample {
  description: string;
  command: string;
}

export interface CommandContext {
  command: CommandDefinition;
  args: Record<string, any>;
  options: Record<string, any>;
  program: Command;
  logger: Logger;
  spinner: Spinner;
  analytics: Analytics;
  config: ConfigManager;
  plugins: PluginHookAPI;
}

export interface CommandMiddleware {
  name: string;
  phase: 'pre' | 'post';
  handler: (context: CommandContext) => Promise<void> | void;
}

export type CommandHandler = (context: CommandContext) => Promise<void> | void;

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  success(message: string, ...args: any[]): void;
}

export interface Spinner {
  start(message: string): void;
  succeed(message?: string): void;
  fail(message?: string): void;
  info(message?: string): void;
  warn(message?: string): void;
  stop(): void;
  isSpinning: boolean;
}

export interface Analytics {
  track(event: string, properties?: Record<string, any>): void;
  timeStart(label: string): void;
  timeEnd(label: string): void;
  increment(metric: string, value?: number): void;
}

export interface ConfigManager {
  get<T = any>(key: string, defaultValue?: T): T;
  set(key: string, value: any): void;
  has(key: string): boolean;
  delete(key: string): void;
  getAll(): Record<string, any>;
}

export class CommandRegistry extends EventEmitter {
  private commands: Map<string, CommandDefinition> = new Map();
  private aliases: Map<string, string> = new Map();
  private categories: Map<string, CommandDefinition[]> = new Map();
  private middleware: CommandMiddleware[] = [];
  private commandHistory: CommandExecution[] = [];

  constructor(
    private logger: Logger,
    private analytics: Analytics,
    private config: ConfigManager,
    private plugins: PluginHookAPI
  ) {
    super();
  }

  /**
   * Register a new command
   */
  async register(definition: CommandDefinition): Promise<void> {
    this.emit('command:registering', definition);

    // Validate command definition
    this.validateCommand(definition);

    // Check for conflicts
    if (this.commands.has(definition.name)) {
      const existing = this.commands.get(definition.name)!;
      if (existing.priority !== undefined && definition.priority !== undefined) {
        if (definition.priority > existing.priority) {
          this.logger.debug(`Overriding command ${definition.name} due to higher priority`);
        } else {
          throw new ValidationError(
            `Command ${definition.name} already registered with higher priority`
          );
        }
      } else if (!definition.plugin) {
        throw new ValidationError(
          `Command ${definition.name} already registered`
        );
      }
    }

    // Register command
    this.commands.set(definition.name, definition);

    // Register aliases
    if (definition.alias) {
      for (const alias of definition.alias) {
        if (this.aliases.has(alias)) {
          throw new ValidationError(
            `Alias ${alias} already registered for command ${this.aliases.get(alias)}`
          );
        }
        this.aliases.set(alias, definition.name);
      }
    }

    // Add to category
    if (definition.category) {
      if (!this.categories.has(definition.category)) {
        this.categories.set(definition.category, []);
      }
      this.categories.get(definition.category)!.push(definition);
    }

    this.emit('command:registered', definition);
    this.logger.debug(`Registered command: ${definition.name}`);
  }

  /**
   * Unregister a command
   */
  async unregister(name: string): Promise<void> {
    const command = this.commands.get(name);
    if (!command) {
      throw new ValidationError(`Command ${name} not found`);
    }

    this.emit('command:unregistering', command);

    // Remove from commands
    this.commands.delete(name);

    // Remove aliases
    if (command.alias) {
      for (const alias of command.alias) {
        this.aliases.delete(alias);
      }
    }

    // Remove from category
    if (command.category) {
      const categoryCommands = this.categories.get(command.category);
      if (categoryCommands) {
        const index = categoryCommands.indexOf(command);
        if (index !== -1) {
          categoryCommands.splice(index, 1);
        }
      }
    }

    this.emit('command:unregistered', command);
    this.logger.debug(`Unregistered command: ${name}`);
  }

  /**
   * Get a command by name or alias
   */
  get(nameOrAlias: string): CommandDefinition | undefined {
    const name = this.aliases.get(nameOrAlias) || nameOrAlias;
    return this.commands.get(name);
  }

  /**
   * Get all commands
   */
  getAll(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   */
  getByCategory(category: string): CommandDefinition[] {
    return this.categories.get(category) || [];
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Add global middleware
   */
  addMiddleware(middleware: CommandMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Create commander command from definition
   */
  createCommand(program: Command, definition: CommandDefinition): Command {
    const cmd = program
      .command(definition.name)
      .description(definition.description);

    // Add aliases
    if (definition.alias && definition.alias.length > 0) {
      for (const alias of definition.alias) {
        cmd.alias(alias);
      }
    }

    // Add arguments
    if (definition.arguments) {
      for (const arg of definition.arguments) {
        const argString = arg.variadic
          ? `<${arg.name}...>`
          : arg.required
          ? `<${arg.name}>`
          : `[${arg.name}]`;
        cmd.argument(argString, arg.description, arg.defaultValue);
      }
    }

    // Add options
    if (definition.options) {
      for (const opt of definition.options) {
        cmd.option(opt.flag, opt.description, opt.defaultValue);
        
        // Add choices validation
        if (opt.choices) {
          cmd.addHelpText('after', `\n  Choices for ${opt.flag}: ${opt.choices.join(', ')}`);
        }
      }
    }

    // Add examples to help
    if (definition.examples) {
      const examplesText = definition.examples
        .map(ex => `  ${ex.description}\n  $ ${ex.command}`)
        .join('\n\n');
      cmd.addHelpText('after', `\nExamples:\n${examplesText}`);
    }

    // Set action handler with middleware
    cmd.action(async (...args) => {
      const context = this.createContext(definition, cmd, args);
      await this.executeCommand(context);
    });

    return cmd;
  }

  /**
   * Execute command with middleware
   */
  private async executeCommand(context: CommandContext): Promise<void> {
    const execution: CommandExecution = {
      command: context.command.name,
      args: context.args,
      options: context.options,
      startTime: Date.now(),
      status: 'running'
    };

    this.commandHistory.push(execution);
    this.emit('command:executing', context);

    try {
      // Run pre middleware
      await this.runMiddleware(context, 'pre');

      // Execute command handler
      await context.command.handler(context);

      // Run post middleware
      await this.runMiddleware(context, 'post');

      execution.status = 'success';
      execution.endTime = Date.now();
      this.emit('command:executed', context);

    } catch (error) {
      execution.status = 'error';
      execution.endTime = Date.now();
      execution.error = error;
      this.emit('command:error', { context, error });
      throw error;
    } finally {
      // Track analytics
      this.analytics.track('command_executed', {
        command: context.command.name,
        duration: execution.endTime! - execution.startTime,
        status: execution.status,
        plugin: context.command.plugin?.name
      });
    }
  }

  /**
   * Run middleware for a phase
   */
  private async runMiddleware(
    context: CommandContext,
    phase: 'pre' | 'post'
  ): Promise<void> {
    // Global middleware
    const globalMiddleware = this.middleware.filter(m => m.phase === phase);
    
    // Command-specific middleware
    const commandMiddleware = (context.command.middleware || [])
      .filter(m => m.phase === phase);

    // Combine and execute
    const allMiddleware = [...globalMiddleware, ...commandMiddleware];
    
    for (const middleware of allMiddleware) {
      this.logger.debug(`Running ${phase} middleware: ${middleware.name}`);
      await middleware.handler(context);
    }
  }

  /**
   * Create command context
   */
  private createContext(
    definition: CommandDefinition,
    cmd: Command,
    args: any[]
  ): CommandContext {
    // Parse arguments
    const parsedArgs: Record<string, any> = {};
    if (definition.arguments) {
      definition.arguments.forEach((arg, index) => {
        if (arg.variadic) {
          parsedArgs[arg.name] = args.slice(index, args.length - 1);
        } else {
          parsedArgs[arg.name] = args[index];
        }
      });
    }

    // Get options
    const options = cmd.opts();

    // Create spinner
    const spinner = this.createSpinner();

    return {
      command: definition,
      args: parsedArgs,
      options,
      program: cmd,
      logger: this.logger,
      spinner,
      analytics: this.analytics,
      config: this.config,
      plugins: this.plugins
    };
  }

  /**
   * Create spinner instance
   */
  private createSpinner(): Spinner {
    let ora: any;
    let instance: any;

    return {
      start(message: string) {
        if (!ora) {
          ora = require('ora');
        }
        instance = ora(message).start();
      },
      succeed(message?: string) {
        if (instance) {
          instance.succeed(message);
          instance = null;
        }
      },
      fail(message?: string) {
        if (instance) {
          instance.fail(message);
          instance = null;
        }
      },
      info(message?: string) {
        if (instance) {
          instance.info(message);
          instance = null;
        }
      },
      warn(message?: string) {
        if (instance) {
          instance.warn(message);
          instance = null;
        }
      },
      stop() {
        if (instance) {
          instance.stop();
          instance = null;
        }
      },
      get isSpinning() {
        return instance?.isSpinning || false;
      }
    };
  }

  /**
   * Validate command definition
   */
  private validateCommand(definition: CommandDefinition): void {
    if (!definition.name) {
      throw new ValidationError('Command name is required');
    }

    if (!definition.description) {
      throw new ValidationError('Command description is required');
    }

    if (!definition.handler) {
      throw new ValidationError('Command handler is required');
    }

    // Validate arguments
    if (definition.arguments) {
      let variadicFound = false;
      for (const arg of definition.arguments) {
        if (variadicFound) {
          throw new ValidationError('Variadic argument must be last');
        }
        if (arg.variadic) {
          variadicFound = true;
        }
      }
    }

    // Validate options
    if (definition.options) {
      for (const opt of definition.options) {
        if (!opt.flag || !opt.description) {
          throw new ValidationError('Option flag and description are required');
        }
      }
    }
  }

  /**
   * Get command history
   */
  getHistory(): CommandExecution[] {
    return [...this.commandHistory];
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = [];
  }

  /**
   * Search commands
   */
  search(query: string): CommandDefinition[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(cmd => 
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery) ||
      cmd.keywords?.some((k: string) => k.toLowerCase().includes(lowerQuery))
    );
  }
}

interface CommandExecution {
  command: string;
  args: Record<string, any>;
  options: Record<string, any>;
  startTime: number;
  endTime?: number;
  status: 'running' | 'success' | 'error';
  error?: any;
}