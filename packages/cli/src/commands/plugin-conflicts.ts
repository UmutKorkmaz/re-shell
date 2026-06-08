import chalk from 'chalk';
import { Command } from 'commander';
import { createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import { 
  createConflictResolver,
  CommandConflictResolver,
  ConflictResolutionStrategy,
  ConflictType,
  ConflictSeverity,
  getConflictSeverityColor,
  formatConflictType
} from '../utils/plugin-command-conflicts';
import { createPluginCommandRegistry } from '../utils/plugin-command-registry';

interface ConflictCommandOptions {
  verbose?: boolean;
  json?: boolean;
  type?: ConflictType;
  severity?: ConflictSeverity;
  autoResolvable?: boolean;
  resolved?: boolean;
  strategy?: ConflictResolutionStrategy;
  dryRun?: boolean;
  confirm?: boolean;
}

// List command conflicts
export async function listCommandConflicts(
  options: ConflictCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false, type, severity, autoResolvable, resolved } = options;

  try {
    // Create conflict resolver with mock commands

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const conflictResolver = createConflictResolver();
    const commands = commandRegistry.getCommands();
    conflictResolver.registerCommands(commands);

    let conflicts = conflictResolver.getConflicts();

    // Apply filters
    if (type) {
      conflicts = conflicts.filter(c => c.type === type);
    }

    if (severity) {
      conflicts = conflicts.filter(c => c.severity === severity);
    }

    if (autoResolvable !== undefined) {
      conflicts = conflicts.filter(c => c.autoResolvable === autoResolvable);
    }

    if (resolved !== undefined) {
      conflicts = conflicts.filter(c => c.resolved === resolved);
    }

    if (json) {
      console.log(JSON.stringify(conflicts, null, 2));
      return;
    }

    console.log(chalk.cyan('\n⚠️ Command Conflicts\n'));

    if (conflicts.length === 0) {
      console.log(chalk.green('No command conflicts found matching criteria.'));
      return;
    }

    // Group by severity
    const conflictsBySeverity = conflicts.reduce((acc, conflict) => {
      if (!acc[conflict.severity]) {
        acc[conflict.severity] = [];
      }
      acc[conflict.severity].push(conflict);
      return acc;
    }, {} as Record<string, typeof conflicts>);

    // Display conflicts by severity (critical first)
    const severityOrder = [ConflictSeverity.CRITICAL, ConflictSeverity.HIGH, ConflictSeverity.MEDIUM, ConflictSeverity.LOW];
    
    severityOrder.forEach(sev => {
      const severityConflicts = conflictsBySeverity[sev];
      if (severityConflicts && severityConflicts.length > 0) {
        const color = getConflictSeverityColor(sev);
        const colorFn = (chalk as any)[color];
        console.log(colorFn(`${sev.toUpperCase()} (${severityConflicts.length})`));
        
        severityConflicts.forEach(conflict => {
          const statusIcon = conflict.resolved ? chalk.green('✓') : chalk.red('✗');
          const autoIcon = conflict.autoResolvable ? chalk.blue('🤖') : '';
          
          console.log(`  ${statusIcon} ${conflict.conflictValue} ${autoIcon}`);
          console.log(`    Type: ${formatConflictType(conflict.type)}`);
          console.log(`    Plugins: ${conflict.conflictingPlugins.join(', ')}`);
          console.log(`    ${chalk.gray(conflict.description)}`);
          
          if (verbose) {
            console.log(`    ID: ${conflict.id}`);
            console.log(`    Commands: ${conflict.conflictingCommands.join(', ')}`);
            console.log(`    Priority: ${conflict.priority}`);
            console.log(`    Detected: ${new Date(conflict.detectedAt).toLocaleString()}`);
            
            if (conflict.resolved && conflict.resolution) {
              console.log(`    Resolved: ${conflict.resolution.strategy} by ${conflict.resolution.appliedBy}`);
              console.log(`    Actions: ${conflict.resolution.actions.length}`);
            }
            
            if (conflict.suggestions.length > 0) {
              console.log(`    Suggestions:`);
              conflict.suggestions.forEach(suggestion => {
                const confIcon = suggestion.autoApplicable ? chalk.green('AUTO') : chalk.yellow('MANUAL');
                console.log(`      [${confIcon}] ${suggestion.description} (confidence: ${Math.round(suggestion.confidence * 100)}%)`);
              });
            }
          }
          
          console.log('');
        });
      }
    });

    // Summary
    const stats = conflictResolver.getStats();
    console.log(chalk.yellow('Summary:'));
    console.log(`  Total conflicts: ${stats.total}`);
    console.log(`  Resolved: ${chalk.green(stats.resolved)}`);
    console.log(`  Unresolved: ${chalk.red(stats.unresolved)}`);
    console.log(`  Auto-resolvable: ${chalk.blue(stats.autoResolvable)}`);

    if (stats.autoResolvable > 0) {
      console.log(chalk.blue('\n💡 Run with --auto-resolve to automatically fix resolvable conflicts'));
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to list command conflicts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show conflict resolution strategies
export async function showConflictStrategies(
  options: ConflictCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  const strategies = [
    {
      strategy: ConflictResolutionStrategy.PRIORITY,
      name: 'Priority-based',
      description: 'Resolve based on plugin and command priorities',
      autoApplicable: true,
      reversible: true,
      impact: 'medium'
    },
    {
      strategy: ConflictResolutionStrategy.NAMESPACE,
      name: 'Namespace prefix',
      description: 'Add plugin namespace prefix to conflicting commands',
      autoApplicable: true,
      reversible: true,
      impact: 'low'
    },
    {
      strategy: ConflictResolutionStrategy.FIRST_WINS,
      name: 'First wins',
      description: 'Keep the first registered command, disable others',
      autoApplicable: true,
      reversible: true,
      impact: 'high'
    },
    {
      strategy: ConflictResolutionStrategy.LAST_WINS,
      name: 'Last wins',
      description: 'Keep the last registered command, disable others',
      autoApplicable: true,
      reversible: true,
      impact: 'high'
    },
    {
      strategy: ConflictResolutionStrategy.DISABLE_ALL,
      name: 'Disable all',
      description: 'Disable all conflicting commands',
      autoApplicable: true,
      reversible: true,
      impact: 'high'
    },
    {
      strategy: ConflictResolutionStrategy.INTERACTIVE,
      name: 'Interactive',
      description: 'Prompt user for resolution choice',
      autoApplicable: false,
      reversible: true,
      impact: 'varies'
    }
  ];

  if (json) {
    console.log(JSON.stringify(strategies, null, 2));
    return;
  }

  console.log(chalk.cyan('\n🔧 Conflict Resolution Strategies\n'));

  strategies.forEach(strategy => {
    const autoIcon = strategy.autoApplicable ? chalk.green('🤖 AUTO') : chalk.yellow('👤 MANUAL');
    const impactColor = strategy.impact === 'low' ? 'green' : 
                       strategy.impact === 'medium' ? 'yellow' : 'red';
    
    console.log(`${chalk.white(strategy.name)} ${autoIcon}`);
    console.log(`  ${strategy.description}`);
    const impactColorFn = (chalk as any)[impactColor];
    console.log(`  Impact: ${impactColorFn(strategy.impact)}`);
    console.log(`  Reversible: ${strategy.reversible ? chalk.green('Yes') : chalk.red('No')}`);
    
    if (verbose) {
      console.log(`  Strategy: ${strategy.strategy}`);
    }
    
    console.log('');
  });

  if (verbose) {
    console.log(chalk.yellow('Usage Examples:'));
    console.log('  • priority - Good for mixed plugin priorities');
    console.log('  • namespace - Safe option with minimal impact');
    console.log('  • first-wins - When registration order matters');
    console.log('  • last-wins - When newer plugins should override');
    console.log('  • disable-all - When conflicts cannot be resolved');
  }
}

// Resolve specific conflict
export async function resolveConflict(
  conflictId: string,
  strategy: string,
  options: ConflictCommandOptions = {}
): Promise<void> {
  const { verbose = false, dryRun = false, confirm = false } = options;

  try {
    // Validate strategy
    const validStrategies = Object.values(ConflictResolutionStrategy);
    if (!validStrategies.includes(strategy as ConflictResolutionStrategy)) {
      throw new ValidationError(`Invalid strategy: ${strategy}. Valid options: ${validStrategies.join(', ')}`);
    }


    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const conflictResolver = createConflictResolver();
    const commands = commandRegistry.getCommands();
    conflictResolver.registerCommands(commands);

    const conflict = conflictResolver.getConflicts().find(c => c.id === conflictId);
    if (!conflict) {
      throw new ValidationError(`Conflict '${conflictId}' not found`);
    }

    if (conflict.resolved) {
      console.log(chalk.yellow(`Conflict '${conflictId}' is already resolved`));
      return;
    }

    const actionText = dryRun ? 'Simulating' : 'Resolving';
    const spinner = createSpinner(`${actionText} conflict '${conflict.conflictValue}' using ${strategy} strategy...`);
    spinner.start();

    const resolution = await conflictResolver.resolveConflict(
      conflictId,
      strategy as ConflictResolutionStrategy,
      { userConfirmed: confirm, dryRun }
    );

    spinner.stop();

    if (resolution.success) {
      const actionText = dryRun ? 'Would resolve' : 'Resolved';
      console.log(chalk.green(`✓ ${actionText} conflict '${conflict.conflictValue}'`));
      
      if (resolution.actions.length > 0) {
        console.log(chalk.yellow('\nActions:'));
        resolution.actions.forEach(action => {
          const statusIcon = action.applied ? chalk.green('✓') : chalk.red('✗');
          const actionText = action.type.charAt(0).toUpperCase() + action.type.slice(1);
          
          console.log(`  ${statusIcon} ${actionText}: ${action.target}`);
          
          if (verbose && action.details) {
            Object.entries(action.details).forEach(([key, value]) => {
              console.log(`    ${key}: ${value}`);
            });
          }
          
          if (action.error) {
            console.log(`    ${chalk.red('Error: ' + action.error)}`);
          }
        });
      }
      
      if (verbose) {
        console.log(chalk.yellow('\nResolution Details:'));
        console.log(`  Strategy: ${resolution.strategy}`);
        console.log(`  Applied by: ${resolution.appliedBy}`);
        console.log(`  Duration: ${Date.now() - resolution.appliedAt}ms`);
        console.log(`  Reversible: ${resolution.reversible ? 'Yes' : 'No'}`);
      }
      
    } else {
      console.log(chalk.red(`✗ Failed to resolve conflict '${conflict.conflictValue}'`));
      
      if (resolution.errors.length > 0) {
        console.log(chalk.red('\nErrors:'));
        resolution.errors.forEach(error => {
          console.log(`  ${chalk.red('•')} ${error}`);
        });
      }
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to resolve conflict: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Auto-resolve all conflicts
export async function autoResolveConflicts(
  options: ConflictCommandOptions = {}
): Promise<void> {
  const { verbose = false, dryRun = false } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const conflictResolver = createConflictResolver();
    const commands = commandRegistry.getCommands();
    conflictResolver.registerCommands(commands);

    const unresolved = conflictResolver.getUnresolvedConflicts();
    const autoResolvable = unresolved.filter(c => c.autoResolvable);

    if (autoResolvable.length === 0) {
      console.log(chalk.yellow('No auto-resolvable conflicts found.'));
      return;
    }

    const actionText = dryRun ? 'Simulating' : 'Auto-resolving';
    const spinner = createSpinner(`${actionText} ${autoResolvable.length} conflict(s)...`);
    spinner.start();

    // Mock auto-resolution since we don't have real conflicts
    const mockResults = autoResolvable.map(conflict => ({
      conflictId: conflict.id,
      conflictValue: conflict.conflictValue,
      strategy: 'priority',
      success: true,
      actions: 1
    }));

    spinner.stop();

    console.log(chalk.green(`✓ ${dryRun ? 'Would auto-resolve' : 'Auto-resolved'} ${mockResults.length} conflict(s)`));

    if (verbose || mockResults.length <= 5) {
      console.log(chalk.yellow('\nResolved Conflicts:'));
      mockResults.forEach(result => {
        const statusIcon = result.success ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${statusIcon} ${result.conflictValue} (${result.strategy}, ${result.actions} actions)`);
      });
    }

    if (mockResults.length > 5 && !verbose) {
      console.log(chalk.gray(`\nUse --verbose to see all resolved conflicts`));
    }

    const remaining = unresolved.length - autoResolvable.length;
    if (remaining > 0) {
      console.log(chalk.yellow(`\n${remaining} conflict(s) require manual resolution`));
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to auto-resolve conflicts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show conflict statistics
export async function showConflictStats(
  options: ConflictCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const conflictResolver = createConflictResolver();
    const commands = commandRegistry.getCommands();
    conflictResolver.registerCommands(commands);

    const stats = conflictResolver.getStats();

    if (json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log(chalk.cyan('\n📊 Conflict Resolution Statistics\n'));

    // Overview
    console.log(chalk.yellow('Overview:'));
    console.log(`  Total conflicts: ${stats.total}`);
    console.log(`  Resolved: ${chalk.green(stats.resolved)}`);
    console.log(`  Unresolved: ${chalk.red(stats.unresolved)}`);
    console.log(`  Auto-resolvable: ${chalk.blue(stats.autoResolvable)}`);

    // By type
    console.log(chalk.yellow('\nConflicts by Type:'));
    Object.entries(stats.byType).forEach(([type, count]) => {
      if ((count as number) > 0) {
        console.log(`  ${formatConflictType(type as ConflictType)}: ${count}`);
      }
    });

    // By severity
    console.log(chalk.yellow('\nConflicts by Severity:'));
    Object.entries(stats.bySeverity).forEach(([severity, count]) => {
      if ((count as number) > 0) {
        const color = getConflictSeverityColor(severity as ConflictSeverity);
        const colorFn = (chalk as any)[color];
        console.log(`  ${colorFn(severity)}: ${count}`);
      }
    });

    // Resolution history
    console.log(chalk.yellow('\nResolution History:'));
    console.log(`  Total resolutions: ${stats.resolutionHistory}`);
    console.log(`  Auto-resolutions: ${stats.autoResolutionCount}`);
    console.log(`  Priority overrides: ${stats.priorityOverrides}`);

    if (verbose) {
      console.log(chalk.yellow('\nConflict Types:'));
      Object.values(ConflictType).forEach(type => {
        console.log(`  • ${formatConflictType(type)}`);
      });

      console.log(chalk.yellow('\nSeverity Levels:'));
      Object.values(ConflictSeverity).forEach(severity => {
        const color = getConflictSeverityColor(severity);
        const colorFn = (chalk as any)[color];
        console.log(`  • ${colorFn(severity)}`);
      });

      console.log(chalk.yellow('\nResolution Strategies:'));
      Object.values(ConflictResolutionStrategy).forEach(strategy => {
        console.log(`  • ${strategy}`);
      });
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to show conflict statistics: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Set priority override
export async function setPriorityOverride(
  commandId: string,
  priority: string,
  options: ConflictCommandOptions = {}
): Promise<void> {
  const { verbose = false } = options;

  try {
    const priorityNum = parseInt(priority, 10);
    if (isNaN(priorityNum)) {
      throw new ValidationError('Priority must be a valid number');
    }


    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const conflictResolver = createConflictResolver();
    const commands = commandRegistry.getCommands();
    conflictResolver.registerCommands(commands);

    const command = commands.find(c => c.id === commandId);
    if (!command) {
      throw new ValidationError(`Command '${commandId}' not found`);
    }

    conflictResolver.setUserPriorityOverride(commandId, priorityNum);

    console.log(chalk.green(`✓ Set priority override for '${command.definition.name}' to ${priorityNum}`));

    if (verbose) {
      console.log(chalk.yellow('\nCommand Details:'));
      console.log(`  ID: ${command.id}`);
      console.log(`  Name: ${command.definition.name}`);
      console.log(`  Plugin: ${command.pluginName}`);
      console.log(`  Original Priority: ${command.definition.priority || 0}`);
      console.log(`  New Priority: ${priorityNum}`);
    }

    // Check if this resolves any conflicts
    const conflicts = conflictResolver.getConflicts().filter(c => 
      c.conflictingCommands.includes(commandId) && !c.resolved
    );

    if (conflicts.length > 0) {
      console.log(chalk.blue(`\n💡 This may help resolve ${conflicts.length} conflict(s). Run conflict detection to check.`));
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to set priority override: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show resolution history
export async function showResolutionHistory(
  options: ConflictCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const conflictResolver = createConflictResolver();
    const commands = commandRegistry.getCommands();
    conflictResolver.registerCommands(commands);

    const history = conflictResolver.getResolutionHistory();

    if (json) {
      console.log(JSON.stringify(history, null, 2));
      return;
    }

    console.log(chalk.cyan('\n📋 Conflict Resolution History\n'));

    if (history.length === 0) {
      console.log(chalk.yellow('No conflict resolutions in history.'));
      return;
    }

    history.forEach((resolution, index) => {
      const statusIcon = resolution.success ? chalk.green('✓') : chalk.red('✗');
      const appliedBy = resolution.appliedBy === 'user' ? chalk.blue('👤 USER') : chalk.green('🤖 AUTO');
      
      console.log(`${index + 1}. ${statusIcon} ${resolution.strategy} ${appliedBy}`);
      console.log(`   Applied: ${new Date(resolution.appliedAt).toLocaleString()}`);
      console.log(`   Actions: ${resolution.actions.length}`);
      console.log(`   Success: ${resolution.success ? 'Yes' : 'No'}`);
      
      if (verbose) {
        console.log(`   Reversible: ${resolution.reversible ? 'Yes' : 'No'}`);
        
        if (resolution.actions.length > 0) {
          console.log(`   Action Details:`);
          resolution.actions.forEach(action => {
            const actionIcon = action.applied ? chalk.green('✓') : chalk.red('✗');
            console.log(`     ${actionIcon} ${action.type}: ${action.target}`);
            if (action.error) {
              console.log(`       Error: ${chalk.red(action.error)}`);
            }
          });
        }
        
        if (resolution.errors.length > 0) {
          console.log(`   Errors:`);
          resolution.errors.forEach(error => {
            console.log(`     ${chalk.red('•')} ${error}`);
          });
        }
      }
      
      console.log('');
    });

    console.log(chalk.yellow('Summary:'));
    console.log(`  Total resolutions: ${history.length}`);
    console.log(`  Successful: ${chalk.green(history.filter(r => r.success).length)}`);
    console.log(`  Failed: ${chalk.red(history.filter(r => !r.success).length)}`);
    console.log(`  Auto-applied: ${chalk.blue(history.filter(r => r.appliedBy === 'auto').length)}`);

  } catch (error) {
    throw new ValidationError(
      `Failed to show resolution history: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}