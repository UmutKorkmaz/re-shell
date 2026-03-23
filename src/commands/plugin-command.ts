import chalk from 'chalk';
import { Command } from 'commander';
import { createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import {
  createPluginCommandRegistry,
  PluginCommandRegistry,
  RegisteredCommand,
  PluginCommandDefinition
} from '../utils/plugin-command-registry';
import { createPluginRegistry } from '../utils/plugin-system';

interface CommandCommandOptions {
  verbose?: boolean;
  json?: boolean;
  plugin?: string;
  category?: string;
  active?: boolean;
  conflicts?: boolean;
  usage?: boolean;
}

// List registered plugin commands
export async function listPluginCommands(
  options: CommandCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false, plugin, category, active, conflicts } = options;

  try {
    const pluginRegistry = createPluginRegistry();
    await pluginRegistry.initialize();

    // Create a temporary command registry to inspect registered commands
    // In a real implementation, this would be injected from the main CLI

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    // Get registered commands
    let commands = commandRegistry.getCommands();

    // Apply filters
    if (plugin) {
      commands = commands.filter(cmd => cmd.pluginName === plugin);
    }

    if (category) {
      commands = commands.filter(cmd => cmd.definition.category === category);
    }

    if (active !== undefined) {
      commands = commands.filter(cmd => cmd.isActive === active);
    }

    if (conflicts) {
      commands = commands.filter(cmd => cmd.conflicts.length > 0);
    }

    if (json) {
      console.log(JSON.stringify(commands, null, 2));
      return;
    }

    console.log(chalk.cyan('\n📋 Registered Plugin Commands\n'));

    if (commands.length === 0) {
      console.log(chalk.yellow('No plugin commands found matching criteria.'));
      return;
    }

    // Group by plugin
    const commandsByPlugin = commands.reduce((acc, cmd) => {
      if (!acc[cmd.pluginName]) {
        acc[cmd.pluginName] = [];
      }
      acc[cmd.pluginName].push(cmd);
      return acc;
    }, {} as Record<string, RegisteredCommand[]>);

    Object.entries(commandsByPlugin).forEach(([pluginName, pluginCommands]) => {
      console.log(chalk.blue(`${pluginName} (${pluginCommands.length} commands)`));
      
      pluginCommands.forEach(cmd => {
        const statusIcon = cmd.isActive ? chalk.green('✓') : chalk.red('✗');
        const conflictBadge = cmd.conflicts.length > 0 ? chalk.red(' [CONFLICT]') : '';
        const deprecatedBadge = cmd.definition.deprecated ? chalk.yellow(' [DEPRECATED]') : '';
        
        console.log(`  ${statusIcon} ${chalk.white(cmd.definition.name)}${conflictBadge}${deprecatedBadge}`);
        console.log(`    ${chalk.gray(cmd.definition.description)}`);
        
        if (cmd.definition.aliases && cmd.definition.aliases.length > 0) {
          console.log(`    ${chalk.gray(`Aliases: ${cmd.definition.aliases.join(', ')}`)}`);
        }
        
        if (verbose) {
          console.log(`    ${chalk.gray(`ID: ${cmd.id}`)}`);
          console.log(`    ${chalk.gray(`Registered: ${new Date(cmd.registeredAt).toLocaleString()}`)}`);
          console.log(`    ${chalk.gray(`Usage: ${cmd.usageCount} times`)}`);
          
          if (cmd.lastUsed) {
            console.log(`    ${chalk.gray(`Last used: ${new Date(cmd.lastUsed).toLocaleString()}`)}`);
          }
          
          if (cmd.definition.category) {
            console.log(`    ${chalk.gray(`Category: ${cmd.definition.category}`)}`);
          }
          
          if (cmd.definition.priority !== undefined) {
            console.log(`    ${chalk.gray(`Priority: ${cmd.definition.priority}`)}`);
          }
          
          if (cmd.conflicts.length > 0) {
            console.log(`    ${chalk.red(`Conflicts: ${cmd.conflicts.join(', ')}`)}`);
          }
        }
        
        console.log('');
      });
    });

    // Summary
    const totalCommands = commands.length;
    const activeCommands = commands.filter(cmd => cmd.isActive).length;
    const conflictingCommands = commands.filter(cmd => cmd.conflicts.length > 0).length;
    
    console.log(chalk.yellow('Summary:'));
    console.log(`  Total commands: ${totalCommands}`);
    console.log(`  Active: ${chalk.green(activeCommands)}`);
    console.log(`  Inactive: ${chalk.red(totalCommands - activeCommands)}`);
    if (conflictingCommands > 0) {
      console.log(`  Conflicts: ${chalk.red(conflictingCommands)}`);
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to list plugin commands: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show command conflicts
export async function showCommandConflicts(
  options: CommandCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const conflicts = commandRegistry.getConflicts();

    if (json) {
      const conflictData = Object.fromEntries(conflicts);
      console.log(JSON.stringify(conflictData, null, 2));
      return;
    }

    console.log(chalk.cyan('\n⚠️ Command Conflicts\n'));

    if (conflicts.size === 0) {
      console.log(chalk.green('No command conflicts detected.'));
      return;
    }

    conflicts.forEach((conflictingIds, commandName) => {
      if (conflictingIds.length > 1) {
        console.log(chalk.red(`Command: ${commandName}`));
        console.log(chalk.yellow(`  ${conflictingIds.length} conflicting registrations:`));
        
        conflictingIds.forEach(commandId => {
          const command = commandRegistry.getCommand(commandId);
          if (command) {
            const statusIcon = command.isActive ? chalk.green('✓') : chalk.red('✗');
            console.log(`    ${statusIcon} ${chalk.white(command.id)} (${command.pluginName})`);
            
            if (verbose) {
              console.log(`      Priority: ${command.definition.priority || 0}`);
              console.log(`      Registered: ${new Date(command.registeredAt).toLocaleString()}`);
              console.log(`      Usage: ${command.usageCount} times`);
            }
          }
        });
        
        console.log('');
      }
    });

    console.log(chalk.yellow('\n💡 Resolution suggestions:'));
    console.log('  • Use plugin command priorities to auto-resolve conflicts');
    console.log('  • Disable conflicting commands manually');
    console.log('  • Use unique command names in plugin development');

  } catch (error) {
    throw new ValidationError(
      `Failed to show command conflicts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Resolve command conflicts
export async function resolveCommandConflicts(
  commandName: string,
  resolution: 'disable' | 'priority',
  options: CommandCommandOptions = {}
): Promise<void> {
  const { verbose = false } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const spinner = createSpinner(`Resolving conflicts for '${commandName}' using ${resolution} strategy...`);
    spinner.start();

    const success = await commandRegistry.resolveConflicts(commandName, resolution);
    
    spinner.stop();

    if (success) {
      console.log(chalk.green(`✓ Successfully resolved conflicts for '${commandName}'`));
      
      if (verbose) {
        const conflicts = commandRegistry.getConflicts().get(commandName);
        if (conflicts) {
          console.log(chalk.yellow('\nResolution details:'));
          conflicts.forEach(commandId => {
            const command = commandRegistry.getCommand(commandId);
            if (command) {
              const status = command.isActive ? chalk.green('active') : chalk.red('disabled');
              console.log(`  ${command.id}: ${status}`);
            }
          });
        }
      }
    } else {
      console.log(chalk.red(`✗ Failed to resolve conflicts for '${commandName}'`));
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to resolve command conflicts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show command registry statistics
export async function showCommandStats(
  options: CommandCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false, usage = false } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const stats = commandRegistry.getStats();

    if (json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log(chalk.cyan('\n📊 Command Registry Statistics\n'));

    // Basic stats
    console.log(chalk.yellow('Overview:'));
    console.log(`  Total commands: ${stats.totalCommands}`);
    console.log(`  Active commands: ${chalk.green(stats.activeCommands)}`);
    console.log(`  Inactive commands: ${chalk.red(stats.totalCommands - stats.activeCommands)}`);
    console.log(`  Total aliases: ${stats.totalAliases}`);
    console.log(`  Command conflicts: ${stats.totalConflicts > 0 ? chalk.red(stats.totalConflicts) : chalk.green(0)}`);

    // Commands by plugin
    if (Object.keys(stats.commandsByPlugin).length > 0) {
      console.log(chalk.yellow('\nCommands by Plugin:'));
      Object.entries(stats.commandsByPlugin).forEach(([plugin, count]) => {
        console.log(`  ${plugin}: ${count}`);
      });
    }

    // Usage statistics
    if (usage && (stats.mostUsedCommands.length > 0 || stats.recentCommands.length > 0)) {
      if (stats.mostUsedCommands.length > 0) {
        console.log(chalk.yellow('\nMost Used Commands:'));
        stats.mostUsedCommands.forEach((cmd: any, index: number) => {
          console.log(`  ${index + 1}. ${cmd.name} (${cmd.plugin}): ${cmd.usageCount} times`);
        });
      }

      if (stats.recentCommands.length > 0) {
        console.log(chalk.yellow('\nRecently Used Commands:'));
        stats.recentCommands.forEach((cmd: any, index: number) => {
          const lastUsed = new Date(cmd.lastUsed).toLocaleString();
          console.log(`  ${index + 1}. ${cmd.name} (${cmd.plugin}): ${lastUsed}`);
        });
      }
    }

    if (verbose) {
      console.log(chalk.yellow('\nRegistry Configuration:'));
      // Would show registry configuration details
      console.log('  Conflict resolution: priority');
      console.log('  Middleware enabled: true');
      console.log('  Usage tracking: true');
      console.log('  Permission validation: true');
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to show command statistics: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Register a command from a plugin (for testing/development)
export async function registerTestCommand(
  pluginName: string,
  commandDefinition: string,
  options: CommandCommandOptions = {}
): Promise<void> {
  const { verbose = false } = options;

  try {
    // Parse command definition (would be JSON or YAML)
    let definition: PluginCommandDefinition;
    try {
      definition = JSON.parse(commandDefinition);
    } catch {
      throw new ValidationError('Command definition must be valid JSON');
    }

    const pluginRegistry = createPluginRegistry();
    await pluginRegistry.initialize();

    const plugin = pluginRegistry.getPlugin(pluginName);
    if (!plugin) {
      throw new ValidationError(`Plugin '${pluginName}' not found`);
    }


    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const spinner = createSpinner(`Registering command '${definition.name}' from plugin '${pluginName}'...`);
    spinner.start();

    const result = await commandRegistry.registerCommand(plugin, definition);
    
    spinner.stop();

    if (result.success) {
      console.log(chalk.green(`✓ Successfully registered command '${definition.name}'`));
      console.log(`  Command ID: ${result.commandId}`);
      
      if (result.warnings.length > 0) {
        console.log(chalk.yellow('  Warnings:'));
        result.warnings.forEach(warning => {
          console.log(`    ${chalk.yellow('⚠')} ${warning}`);
        });
      }
      
      if (verbose && result.conflicts.length > 0) {
        console.log(chalk.red('  Conflicts detected:'));
        result.conflicts.forEach(conflict => {
          console.log(`    ${chalk.red('✗')} ${conflict}`);
        });
      }
    } else {
      console.log(chalk.red(`✗ Failed to register command '${definition.name}'`));
      
      if (result.errors.length > 0) {
        console.log(chalk.red('  Errors:'));
        result.errors.forEach(error => {
          console.log(`    ${chalk.red('✗')} ${error}`);
        });
      }
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to register test command: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Unregister a command
export async function unregisterCommand(
  commandId: string,
  options: CommandCommandOptions = {}
): Promise<void> {
  const { verbose = false } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const command = commandRegistry.getCommand(commandId);
    if (!command) {
      console.log(chalk.yellow(`Command '${commandId}' not found`));
      return;
    }

    const spinner = createSpinner(`Unregistering command '${commandId}'...`);
    spinner.start();

    const success = await commandRegistry.unregisterCommand(commandId);
    
    spinner.stop();

    if (success) {
      console.log(chalk.green(`✓ Successfully unregistered command '${commandId}'`));
      
      if (verbose) {
        console.log(`  Command: ${command.definition.name}`);
        console.log(`  Plugin: ${command.pluginName}`);
        console.log(`  Usage count: ${command.usageCount}`);
      }
    } else {
      console.log(chalk.red(`✗ Failed to unregister command '${commandId}'`));
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to unregister command: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show detailed information about a specific command
export async function showCommandInfo(
  commandId: string,
  options: CommandCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const command = commandRegistry.getCommand(commandId);
    if (!command) {
      console.log(chalk.red(`Command '${commandId}' not found`));
      return;
    }

    if (json) {
      console.log(JSON.stringify(command, null, 2));
      return;
    }

    console.log(chalk.cyan(`\n📋 Command Information: ${command.definition.name}\n`));

    // Basic information
    console.log(chalk.yellow('Basic Information:'));
    console.log(`  Name: ${chalk.white(command.definition.name)}`);
    console.log(`  Description: ${command.definition.description}`);
    console.log(`  Plugin: ${chalk.blue(command.pluginName)}`);
    console.log(`  ID: ${command.id}`);
    console.log(`  Status: ${command.isActive ? chalk.green('Active') : chalk.red('Inactive')}`);
    
    if (command.definition.category) {
      console.log(`  Category: ${command.definition.category}`);
    }
    
    if (command.definition.priority !== undefined) {
      console.log(`  Priority: ${command.definition.priority}`);
    }

    // Aliases
    if (command.definition.aliases && command.definition.aliases.length > 0) {
      console.log(`  Aliases: ${command.definition.aliases.join(', ')}`);
    }

    // Arguments
    if (command.definition.arguments && command.definition.arguments.length > 0) {
      console.log(chalk.yellow('\nArguments:'));
      command.definition.arguments.forEach(arg => {
        const required = arg.required ? chalk.red('required') : chalk.green('optional');
        console.log(`  ${arg.name} (${required}): ${arg.description}`);
        if (arg.type) console.log(`    Type: ${arg.type}`);
        if (arg.choices) console.log(`    Choices: ${arg.choices.join(', ')}`);
        if (arg.defaultValue !== undefined) console.log(`    Default: ${arg.defaultValue}`);
      });
    }

    // Options
    if (command.definition.options && command.definition.options.length > 0) {
      console.log(chalk.yellow('\nOptions:'));
      command.definition.options.forEach(opt => {
        const required = opt.required ? chalk.red('required') : chalk.green('optional');
        console.log(`  ${opt.flag} (${required}): ${opt.description}`);
        if (opt.type) console.log(`    Type: ${opt.type}`);
        if (opt.choices) console.log(`    Choices: ${opt.choices.join(', ')}`);
        if (opt.defaultValue !== undefined) console.log(`    Default: ${opt.defaultValue}`);
        if (opt.conflicts) console.log(`    Conflicts: ${opt.conflicts.join(', ')}`);
        if (opt.implies) console.log(`    Implies: ${opt.implies.join(', ')}`);
      });
    }

    // Examples
    if (command.definition.examples && command.definition.examples.length > 0) {
      console.log(chalk.yellow('\nExamples:'));
      command.definition.examples.forEach(example => {
        console.log(`  ${chalk.gray(example)}`);
      });
    }

    // Usage statistics
    console.log(chalk.yellow('\nUsage Statistics:'));
    console.log(`  Usage count: ${command.usageCount}`);
    console.log(`  Registered: ${new Date(command.registeredAt).toLocaleString()}`);
    if (command.lastUsed) {
      console.log(`  Last used: ${new Date(command.lastUsed).toLocaleString()}`);
    }

    // Conflicts
    if (command.conflicts.length > 0) {
      console.log(chalk.red('\nConflicts:'));
      command.conflicts.forEach(conflictId => {
        const conflictCmd = commandRegistry.getCommand(conflictId);
        if (conflictCmd) {
          console.log(`  ${conflictId} (${conflictCmd.pluginName})`);
        } else {
          console.log(`  ${conflictId}`);
        }
      });
    }

    // Additional details in verbose mode
    if (verbose) {
      console.log(chalk.yellow('\nAdditional Details:'));
      console.log(`  Hidden: ${command.definition.hidden || false}`);
      console.log(`  Deprecated: ${command.definition.deprecated || false}`);
      console.log(`  Permission: ${command.definition.permission || 'none'}`);
      console.log(`  Middleware count: ${command.definition.middleware?.length || 0}`);
      console.log(`  Subcommands: ${command.definition.subcommands?.length || 0}`);
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to show command information: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}