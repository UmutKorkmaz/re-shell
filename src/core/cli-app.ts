#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs-extra';
import { CommandRegistry, CommandDefinition } from './command-registry';
import { Logger, getGlobalLogger, LogLevel } from './logger';
import { Analytics, getGlobalAnalytics } from './analytics';
import { ConfigManager, getGlobalConfig } from './config-manager';
import { PluginHookAPI } from '../utils/plugin-hooks';

export interface CLIAppOptions {
  name: string;
  version: string;
  description: string;
  logger?: Logger;
  analytics?: Analytics;
  config?: ConfigManager;
  plugins?: PluginHookAPI;
}

export class CLIApp {
  private program: Command;
  private registry: CommandRegistry;
  private logger: Logger;
  private analytics: Analytics;
  private config: ConfigManager;
  private plugins?: PluginHookAPI;
  private initialized = false;

  constructor(private options: CLIAppOptions) {
    this.logger = options.logger || getGlobalLogger();
    this.analytics = options.analytics || getGlobalAnalytics();
    this.config = options.config || getGlobalConfig();
    this.plugins = options.plugins;

    // Create commander program
    this.program = new Command();
    this.program
      .name(options.name)
      .version(options.version)
      .description(options.description);

    // Create command registry
    this.registry = new CommandRegistry(
      this.logger,
      this.analytics,
      this.config,
      this.plugins || {} as any
    );

    this.setupGlobalOptions();
    this.setupGlobalMiddleware();
    this.setupEventHandlers();
  }

  private setupGlobalOptions(): void {
    this.program
      .option('--debug', 'Enable debug mode', false)
      .option('--verbose', 'Enable verbose output', false)
      .option('--quiet', 'Suppress output', false)
      .option('--yes', 'Skip interactive prompts', false)
      .option('--no-color', 'Disable colored output', false)
      .option('--profile', 'Enable performance profiling', false)
      .option('--log-level <level>', 'Set log level (debug, info, warn, error)', 'info')
      .option('--config <path>', 'Specify config file path')
      .option('--no-analytics', 'Disable analytics tracking', false);
  }

  private setupGlobalMiddleware(): void {
    // Pre-execution middleware
    this.registry.addMiddleware({
      name: 'global-setup',
      phase: 'pre',
      handler: async (context) => {
        // Configure logger based on options
        if (context.options.debug) {
          this.logger.setLevel(LogLevel.DEBUG);
        } else if (context.options.quiet) {
          this.logger.setLevel(LogLevel.ERROR);
        } else if (context.options.verbose) {
          this.logger.setLevel(LogLevel.DEBUG);
        } else {
          const level = this.parseLogLevel(context.options.logLevel || 'info');
          this.logger.setLevel(level);
        }

        // Disable color if requested
        if (context.options.noColor) {
          chalk.level = 0;
        }

        // Disable analytics if requested
        if (context.options.noAnalytics) {
          this.analytics.disable();
        }

        // Load custom config if specified
        if (context.options.config) {
          this.config.setProjectPath(context.options.config);
        }

        this.logger.debug('Command execution started', {
          command: context.command.name,
          args: context.args,
          options: context.options
        });
      }
    });

    // Performance profiling middleware
    this.registry.addMiddleware({
      name: 'profiling',
      phase: 'pre',
      handler: async (context) => {
        if (context.options.profile) {
          context.analytics.timeStart(`command_${context.command.name}`);
        }
      }
    });

    this.registry.addMiddleware({
      name: 'profiling-end',
      phase: 'post',
      handler: async (context) => {
        if (context.options.profile) {
          context.analytics.timeEnd(`command_${context.command.name}`);
        }
      }
    });

    // Error handling middleware
    this.registry.addMiddleware({
      name: 'error-handler',
      phase: 'post',
      handler: async (context) => {
        this.logger.debug('Command execution completed', {
          command: context.command.name
        });
      }
    });
  }

  private parseLogLevel(level: string): LogLevel {
    const levelMap: Record<string, LogLevel> = {
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
      silent: LogLevel.SILENT
    };
    
    return levelMap[level.toLowerCase()] || LogLevel.INFO;
  }

  private setupEventHandlers(): void {
    // Handle registry events
    this.registry.on('command:executing', (context) => {
      this.analytics.track('command_start', {
        command: context.command.name,
        args: Object.keys(context.args),
        options: Object.keys(context.options)
      });
    });

    this.registry.on('command:executed', (context) => {
      this.analytics.track('command_success', {
        command: context.command.name
      });
    });

    this.registry.on('command:error', ({ context, error }) => {
      this.logger.error(`Command ${context.command.name} failed`, error);
      this.analytics.track('command_error', {
        command: context.command.name,
        error: error.name,
        message: error.message
      });
    });

    // Handle process signals
    process.on('SIGINT', () => {
      this.logger.info('Received SIGINT, shutting down gracefully...');
      this.shutdown();
    });

    process.on('SIGTERM', () => {
      this.logger.info('Received SIGTERM, shutting down gracefully...');
      this.shutdown();
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', error);
      this.analytics.track('uncaught_exception', {
        error: error.name,
        message: error.message,
        stack: error.stack
      });
      this.shutdown(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection', reason);
      this.analytics.track('unhandled_rejection', {
        reason: String(reason)
      });
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.logger.debug('Initializing CLI application...');

      // Initialize plugins if available
      if (this.plugins && typeof this.plugins === 'object' && 'executeHook' in this.plugins) {
        await (this.plugins as any).executeHook('cli:init', {});
      }

      // Load built-in commands
      await this.loadBuiltinCommands();

      // Load plugin commands
      if (this.plugins) {
        await this.loadPluginCommands();
      }

      this.initialized = true;
      this.logger.debug('CLI application initialized');

      this.analytics.track('cli_init', {
        version: this.options.version,
        commandCount: this.registry.getAll().length
      });

    } catch (error: any) {
      this.logger.error('Failed to initialize CLI application', error);
      throw error;
    }
  }

  private async loadBuiltinCommands(): Promise<void> {
    const commandsDir = path.join(__dirname, '..', 'commands');
    
    if (!fs.existsSync(commandsDir)) {
      this.logger.warn('Commands directory not found:', commandsDir);
      return;
    }

    const commandFiles = fs.readdirSync(commandsDir)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .filter(file => !file.endsWith('.d.ts'));

    for (const file of commandFiles) {
      try {
        const commandPath = path.join(commandsDir, file);
        const commandModule = await import(commandPath);
        
        if (commandModule.default && typeof commandModule.default === 'object') {
          const definition = commandModule.default as CommandDefinition;
          await this.registry.register(definition);
        }
      } catch (error: any) {
        this.logger.warn(`Failed to load command ${file}:`, error.message);
      }
    }
  }

  private async loadPluginCommands(): Promise<void> {
    // TODO: Load commands from active plugins
    this.logger.debug('Loading plugin commands...');
  }

  registerCommand(definition: CommandDefinition): void {
    this.registry.register(definition);
  }

  unregisterCommand(name: string): void {
    this.registry.unregister(name);
  }

  getCommand(name: string): CommandDefinition | undefined {
    return this.registry.get(name);
  }

  getAllCommands(): CommandDefinition[] {
    return this.registry.getAll();
  }

  async run(argv?: string[]): Promise<void> {
    try {
      await this.initialize();

      // Register all commands with commander
      for (const definition of this.registry.getAll()) {
        this.registry.createCommand(this.program, definition);
      }

      // Add help command
      this.addHelpCommand();

      // Parse and execute
      await this.program.parseAsync(argv || process.argv);

    } catch (error: any) {
      this.logger.error('CLI execution failed', error);
      this.analytics.track('cli_error', {
        error: error.name,
        message: error.message
      });
      process.exit(1);
    }
  }

  private addHelpCommand(): void {
    this.program
      .command('help [command]')
      .description('Display help for a command')
      .action((command) => {
        if (command) {
          const cmd = this.registry.get(command);
          if (cmd) {
            this.displayCommandHelp(cmd);
          } else {
            console.log(chalk.red(`Command '${command}' not found`));
            process.exit(1);
          }
        } else {
          this.displayGeneralHelp();
        }
      });
  }

  private displayCommandHelp(command: CommandDefinition): void {
    console.log(chalk.bold(`\n${command.name} - ${command.description}\n`));

    if (command.alias && command.alias.length > 0) {
      console.log(chalk.gray(`Aliases: ${command.alias.join(', ')}\n`));
    }

    if (command.arguments && command.arguments.length > 0) {
      console.log(chalk.bold('Arguments:'));
      for (const arg of command.arguments) {
        const argName = arg.variadic ? `${arg.name}...` : arg.name;
        const required = arg.required ? chalk.red('required') : chalk.gray('optional');
        console.log(`  ${chalk.cyan(argName)} - ${arg.description} (${required})`);
      }
      console.log();
    }

    if (command.options && command.options.length > 0) {
      console.log(chalk.bold('Options:'));
      for (const opt of command.options) {
        const required = opt.required ? chalk.red(' [required]') : '';
        console.log(`  ${chalk.cyan(opt.flag)} - ${opt.description}${required}`);
      }
      console.log();
    }

    if (command.examples && command.examples.length > 0) {
      console.log(chalk.bold('Examples:'));
      for (const example of command.examples) {
        console.log(`  ${example.description}`);
        console.log(`  ${chalk.gray('$')} ${example.command}\n`);
      }
    }
  }

  private displayGeneralHelp(): void {
    console.log(chalk.bold(`\n${this.options.name} v${this.options.version}\n`));
    console.log(`${this.options.description}\n`);

    const categories = this.registry.getCategories();
    
    if (categories.length > 0) {
      for (const category of categories) {
        const commands = this.registry.getByCategory(category);
        if (commands.length > 0) {
          console.log(chalk.bold(`${category.toUpperCase()} COMMANDS:`));
          for (const cmd of commands) {
            if (!cmd.hidden) {
              console.log(`  ${chalk.cyan(cmd.name.padEnd(20))} ${cmd.description}`);
            }
          }
          console.log();
        }
      }
    } else {
      console.log(chalk.bold('COMMANDS:'));
      for (const cmd of this.registry.getAll()) {
        if (!cmd.hidden) {
          console.log(`  ${chalk.cyan(cmd.name.padEnd(20))} ${cmd.description}`);
        }
      }
      console.log();
    }

    console.log(chalk.bold('GLOBAL OPTIONS:'));
    console.log('  --debug              Enable debug mode');
    console.log('  --verbose            Enable verbose output');
    console.log('  --quiet              Suppress output');
    console.log('  --yes                Skip interactive prompts');
    console.log('  --no-color           Disable colored output');
    console.log('  --profile            Enable performance profiling');
    console.log('  --log-level <level>  Set log level (debug, info, warn, error)');
    console.log('  --config <path>      Specify config file path');
    console.log('  --no-analytics       Disable analytics tracking');
    console.log();

    console.log(`Use "${this.options.name} help <command>" for more information about a command.`);
  }

  private shutdown(exitCode = 0): void {
    this.logger.debug('Shutting down CLI application...');
    
    // Flush analytics
    this.analytics.flush();
    
    // Close logger
    this.logger.close();
    
    // Exit
    process.exit(exitCode);
  }

  getLogger(): Logger {
    return this.logger;
  }

  getAnalytics(): Analytics {
    return this.analytics;
  }

  getConfig(): ConfigManager {
    return this.config;
  }

  getRegistry(): CommandRegistry {
    return this.registry;
  }
}