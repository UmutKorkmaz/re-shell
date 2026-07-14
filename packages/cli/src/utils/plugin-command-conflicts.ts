import { EventEmitter } from 'events';

import { ValidationError } from './error-handler';
import { RegisteredCommand } from './plugin-command-registry';

/**
 * Strategies available for resolving command conflicts between plugins.
 */
export enum ConflictResolutionStrategy {
  /** Keeps the first registered command and disables the rest. */
  FIRST_WINS = 'first-wins',
  /** Keeps the last registered command and disables the rest. */
  LAST_WINS = 'last-wins',
  /** Resolves the conflict using computed plugin/command priorities. */
  PRIORITY = 'priority',
  /** Resolves the conflict by prefixing command names with a namespace. */
  NAMESPACE = 'namespace',
  /** Prompts the user interactively to choose which command to keep. */
  INTERACTIVE = 'interactive',
  /** Attempts to automatically merge conflicting commands into one. */
  AUTO_MERGE = 'auto-merge',
  /** Disables all conflicting commands. */
  DISABLE_ALL = 'disable-all'
}

/**
 * Categorizes the kind of conflict detected between commands.
 */
export enum ConflictType {
  /** Two or more commands share the same primary name. */
  COMMAND_NAME = 'command-name',
  /** Two or more commands share the same alias. */
  ALIAS = 'alias',
  /** Two or more commands share the same subcommand name. */
  SUBCOMMAND = 'subcommand',
  /** A single command defines duplicate option flags. */
  OPTION = 'option',
  /** Conflicting or duplicate command descriptions. */
  DESCRIPTION = 'description'
}

/**
 * Severity levels indicating the impact of a detected conflict.
 */
export enum ConflictSeverity {
  /** Minor conflict with minimal user impact. */
  LOW = 'low',
  /** Moderate conflict that may affect usability. */
  MEDIUM = 'medium',
  /** Significant conflict that likely breaks expected behavior. */
  HIGH = 'high',
  /** Severe conflict, typically involving system commands, requiring immediate attention. */
  CRITICAL = 'critical'
}

/**
 * Represents a detected conflict between one or more registered commands.
 */
export interface CommandConflict {
  /** Unique identifier for this conflict. */
  id: string;
  /** The category of conflict (name, alias, option, etc.). */
  type: ConflictType;
  /** How severe the conflict is. */
  severity: ConflictSeverity;
  /** IDs of the commands involved in the conflict. */
  conflictingCommands: string[];
  /** Names of the plugins whose commands conflict. */
  conflictingPlugins: string[];
  /** The shared value (name, alias, or flag) causing the conflict. */
  conflictValue: string;
  /** Human-readable description of the conflict. */
  description: string;
  /** Suggested ways to resolve the conflict. */
  suggestions: ConflictSuggestion[];
  /** Whether the conflict can be resolved automatically. */
  autoResolvable: boolean;
  /** Computed priority used when sorting and auto-resolving. */
  priority: number;
  /** Timestamp (ms) when the conflict was first detected. */
  detectedAt: number;
  /** Whether the conflict has been resolved. */
  resolved: boolean;
  /** The resolution applied, if the conflict has been resolved. */
  resolution?: ConflictResolution;
}

/**
 * A single suggestion for how a conflict could be resolved.
 */
export interface ConflictSuggestion {
  /** The kind of resolution action suggested. */
  type: 'rename' | 'namespace' | 'disable' | 'merge' | 'priority';
  /** Human-readable explanation of the suggestion. */
  description: string;
  /** Concrete action text describing what would happen. */
  action: string;
  /** Estimated impact level of applying this suggestion. */
  impact: 'low' | 'medium' | 'high';
  /** Whether the suggestion can be applied automatically without user input. */
  autoApplicable: boolean;
  /** Confidence score (0-1) for how suitable this suggestion is. */
  confidence: number;
}

/**
 * The outcome of attempting to resolve a conflict.
 */
export interface ConflictResolution {
  /** The strategy that was used to resolve the conflict. */
  strategy: ConflictResolutionStrategy;
  /** Timestamp (ms) when the resolution was applied. */
  appliedAt: number;
  /** Whether the resolution was applied by a user or automatically. */
  appliedBy: 'user' | 'auto';
  /** Individual actions taken as part of the resolution. */
  actions: ConflictResolutionAction[];
  /** Whether all actions completed successfully. */
  success: boolean;
  /** Error messages produced during resolution, if any. */
  errors: string[];
  /** Whether the resolution can be rolled back. */
  reversible: boolean;
}

/**
 * A single action performed while resolving a conflict.
 */
export interface ConflictResolutionAction {
  /** The type of action taken against the target command. */
  type: 'rename' | 'disable' | 'namespace' | 'priority' | 'merge';
  /** ID of the command affected by this action. */
  target: string;
  /** Additional details describing what changed. */
  details: Record<string, unknown>;
  /** Whether the action was successfully applied. */
  applied: boolean;
  /** Error message if the action failed. */
  error?: string;
}

/**
 * Configuration controlling how command and plugin priorities are computed.
 */
export interface PriorityConfig {
  /** Priority values keyed by plugin name. */
  pluginPriorities: Map<string, number>;
  /** Priority values keyed by command category. */
  categoryPriorities: Map<string, number>;
  /** Fallback priority when no specific mapping exists. */
  defaultPriority: number;
  /** User-supplied per-command priority overrides. */
  userOverrides: Map<string, number>;
  /** Set of command names treated as protected system commands. */
  systemCommands: Set<string>;
}

/**
 * Policy governing how conflicts are detected and resolved.
 */
export interface ConflictResolutionPolicy {
  /** Strategy used when no type-specific strategy applies. */
  defaultStrategy: ConflictResolutionStrategy;
  /** Strategy overrides keyed by conflict type. */
  strategyByType: Map<ConflictType, ConflictResolutionStrategy>;
  /** Whether automatic (non-interactive) resolution is permitted. */
  allowAutoResolution: boolean;
  /** Whether the user must confirm before a resolution is applied. */
  requireConfirmation: boolean;
  /** Maximum number of conflicts that may be auto-resolved. */
  maxAutoResolutions: number;
  /** Whether system commands should always be kept during resolution. */
  preserveSystemCommands: boolean;
  /** Prefix applied to namespaced commands during resolution. */
  namespacePrefix?: string;
}

/**
 * Detects, tracks, and resolves conflicts between commands registered by
 * different plugins. Emits events for conflict detection and resolution.
 */
export class CommandConflictResolver extends EventEmitter {
  private conflicts: Map<string, CommandConflict> = new Map();
  private commands: Map<string, RegisteredCommand> = new Map();
  private priorityConfig: PriorityConfig;
  private resolutionPolicy: ConflictResolutionPolicy;
  private resolutionHistory: ConflictResolution[] = [];
  private autoResolutionCount = 0;

  /**
   * Creates a new CommandConflictResolver instance.
   *
   * @param priorityConfig - Optional partial overrides for priority configuration.
   * @param resolutionPolicy - Optional partial overrides for the resolution policy.
   */
  constructor(
    priorityConfig?: Partial<PriorityConfig>,
    resolutionPolicy?: Partial<ConflictResolutionPolicy>
  ) {
    super();
    
    this.priorityConfig = {
      pluginPriorities: new Map([
        ['core', 1000],
        ['system', 900],
        ['official', 800],
        ['verified', 700],
        ['community', 500],
        ['user', 300]
      ]),
      categoryPriorities: new Map([
        ['system', 1000],
        ['core', 900],
        ['dev-tools', 800],
        ['productivity', 700],
        ['utility', 600],
        ['extension', 500]
      ]),
      defaultPriority: 100,
      userOverrides: new Map(),
      systemCommands: new Set(['help', 'version', 'init', 'config']),
      ...priorityConfig
    };

    this.resolutionPolicy = {
      defaultStrategy: ConflictResolutionStrategy.PRIORITY,
      strategyByType: new Map([
        [ConflictType.COMMAND_NAME, ConflictResolutionStrategy.PRIORITY],
        [ConflictType.ALIAS, ConflictResolutionStrategy.NAMESPACE],
        [ConflictType.SUBCOMMAND, ConflictResolutionStrategy.AUTO_MERGE],
        [ConflictType.OPTION, ConflictResolutionStrategy.PRIORITY]
      ]),
      allowAutoResolution: true,
      requireConfirmation: false,
      maxAutoResolutions: 10,
      preserveSystemCommands: true,
      namespacePrefix: 'plugin',
      ...resolutionPolicy
    };
  }

  /**
   * Registers a set of commands and immediately runs conflict detection.
   *
   * @param commands - The commands to register for conflict analysis.
   */
  registerCommands(commands: RegisteredCommand[]): void {
    this.commands.clear();
    commands.forEach(cmd => {
      this.commands.set(cmd.id, cmd);
    });
    
    this.detectConflicts();
  }

  /**
   * Runs all conflict detection checks and stores the results.
   *
   * @returns An array of all detected conflicts.
   */
  detectConflicts(): CommandConflict[] {
    this.conflicts.clear();
    const detectedConflicts: CommandConflict[] = [];

    // Detect command name conflicts
    detectedConflicts.push(...this.detectCommandNameConflicts());
    
    // Detect alias conflicts
    detectedConflicts.push(...this.detectAliasConflicts());
    
    // Detect option conflicts
    detectedConflicts.push(...this.detectOptionConflicts());

    // Store conflicts
    detectedConflicts.forEach(conflict => {
      this.conflicts.set(conflict.id, conflict);
    });

    this.emit('conflicts-detected', detectedConflicts);
    return detectedConflicts;
  }

  /**
   * Detects conflicts where multiple commands share the same primary name.
   *
   * @private
   * @returns An array of command-name conflicts.
   */
  private detectCommandNameConflicts(): CommandConflict[] {
    const conflicts: CommandConflict[] = [];
    const nameGroups = new Map<string, RegisteredCommand[]>();

    // Group commands by name
    Array.from(this.commands.values()).forEach(cmd => {
      const name = cmd.definition.name;
      if (!nameGroups.has(name)) {
        nameGroups.set(name, []);
      }
      nameGroups.get(name)!.push(cmd);
    });

    // Find conflicts
    nameGroups.forEach((commands, name) => {
      if (commands.length > 1) {
        const conflict = this.createCommandNameConflict(name, commands);
        conflicts.push(conflict);
      }
    });

    return conflicts;
  }

  /**
   * Detects conflicts where multiple commands share the same alias.
   *
   * @private
   * @returns An array of alias conflicts.
   */
  private detectAliasConflicts(): CommandConflict[] {
    const conflicts: CommandConflict[] = [];
    const aliasMap = new Map<string, RegisteredCommand[]>();

    // Collect all aliases
    Array.from(this.commands.values()).forEach(cmd => {
      if (cmd.definition.aliases) {
        cmd.definition.aliases.forEach(alias => {
          if (!aliasMap.has(alias)) {
            aliasMap.set(alias, []);
          }
          aliasMap.get(alias)!.push(cmd);
        });
      }
    });

    // Find conflicts
    aliasMap.forEach((commands, alias) => {
      if (commands.length > 1) {
        const conflict = this.createAliasConflict(alias, commands);
        conflicts.push(conflict);
      }
    });

    return conflicts;
  }

  /**
   * Detects conflicts where a single command defines duplicate option flags.
   *
   * @private
   * @returns An array of option conflicts.
   */
  private detectOptionConflicts(): CommandConflict[] {
    const conflicts: CommandConflict[] = [];

    Array.from(this.commands.values()).forEach(cmd => {
      if (cmd.definition.options) {
        const optionFlags = new Map<string, number>();
        
        cmd.definition.options.forEach(option => {
          const flag = this.normalizeFlag(option.flag);
          optionFlags.set(flag, (optionFlags.get(flag) || 0) + 1);
        });

        optionFlags.forEach((count, flag) => {
          if (count > 1) {
            const conflict = this.createOptionConflict(cmd, flag);
            conflicts.push(conflict);
          }
        });
      }
    });

    return conflicts;
  }

  /**
   * Builds a CommandConflict object for a command-name collision.
   *
   * @private
   * @param name - The shared command name.
   * @param commands - The commands that share the name.
   * @returns A populated CommandConflict instance.
   */
  private createCommandNameConflict(
    name: string,
    commands: RegisteredCommand[]
  ): CommandConflict {
    const severity = this.priorityConfig.systemCommands.has(name) 
      ? ConflictSeverity.CRITICAL 
      : ConflictSeverity.HIGH;

    const suggestions = this.generateConflictSuggestions(name, commands, ConflictType.COMMAND_NAME);

    return {
      id: `cmd_${name}_${Date.now()}`,
      type: ConflictType.COMMAND_NAME,
      severity,
      conflictingCommands: commands.map(c => c.id),
      conflictingPlugins: [...new Set(commands.map(c => c.pluginName))],
      conflictValue: name,
      description: `Multiple commands registered with name '${name}'`,
      suggestions,
      autoResolvable: severity !== ConflictSeverity.CRITICAL && suggestions.some(s => s.autoApplicable),
      priority: this.calculateConflictPriority(commands),
      detectedAt: Date.now(),
      resolved: false
    };
  }

  /**
   * Builds a CommandConflict object for an alias collision.
   *
   * @private
   * @param alias - The shared alias.
   * @param commands - The commands that share the alias.
   * @returns A populated CommandConflict instance.
   */
  private createAliasConflict(
    alias: string,
    commands: RegisteredCommand[]
  ): CommandConflict {
    const suggestions = this.generateConflictSuggestions(alias, commands, ConflictType.ALIAS);

    return {
      id: `alias_${alias}_${Date.now()}`,
      type: ConflictType.ALIAS,
      severity: ConflictSeverity.MEDIUM,
      conflictingCommands: commands.map(c => c.id),
      conflictingPlugins: [...new Set(commands.map(c => c.pluginName))],
      conflictValue: alias,
      description: `Multiple commands registered with alias '${alias}'`,
      suggestions,
      autoResolvable: suggestions.some(s => s.autoApplicable),
      priority: this.calculateConflictPriority(commands),
      detectedAt: Date.now(),
      resolved: false
    };
  }

  /**
   * Builds a CommandConflict object for a duplicate option flag within a command.
   *
   * @private
   * @param command - The command with the duplicate flag.
   * @param flag - The duplicated option flag.
   * @returns A populated CommandConflict instance.
   */
  private createOptionConflict(
    command: RegisteredCommand,
    flag: string
  ): CommandConflict {
    return {
      id: `opt_${command.id}_${flag}_${Date.now()}`,
      type: ConflictType.OPTION,
      severity: ConflictSeverity.LOW,
      conflictingCommands: [command.id],
      conflictingPlugins: [command.pluginName],
      conflictValue: flag,
      description: `Duplicate option flag '${flag}' in command '${command.definition.name}'`,
      suggestions: [{
        type: 'rename',
        description: 'Rename duplicate option flags',
        action: `Rename conflicting '${flag}' options`,
        impact: 'low',
        autoApplicable: true,
        confidence: 0.9
      }],
      autoResolvable: true,
      priority: 1,
      detectedAt: Date.now(),
      resolved: false
    };
  }

  /**
   * Generates a list of possible resolution suggestions for a conflict.
   *
   * @private
   * @param conflictValue - The shared value causing the conflict.
   * @param commands - The conflicting commands.
   * @param type - The type of conflict.
   * @returns An array of suggestions sorted roughly by applicability.
   */
  private generateConflictSuggestions(
    conflictValue: string,
    commands: RegisteredCommand[],
    type: ConflictType
  ): ConflictSuggestion[] {
    const suggestions: ConflictSuggestion[] = [];

    // Priority-based resolution
    if (commands.length === 2) {
      const priorities = commands.map(cmd => this.calculateCommandPriority(cmd));
      const maxPriority = Math.max(...priorities);
      const hasUniqueHighest = priorities.filter(p => p === maxPriority).length === 1;

      if (hasUniqueHighest) {
        suggestions.push({
          type: 'priority',
          description: 'Resolve based on plugin priority',
          action: 'Keep highest priority command, disable others',
          impact: 'medium',
          autoApplicable: true,
          confidence: 0.8
        });
      }
    }

    // Namespace resolution
    suggestions.push({
      type: 'namespace',
      description: 'Add plugin namespace prefix',
      action: `Rename to ${this.resolutionPolicy.namespacePrefix}:pluginname:${conflictValue}`,
      impact: 'low',
      autoApplicable: type !== ConflictType.COMMAND_NAME,
      confidence: 0.9
    });

    // Rename suggestions
    commands.forEach((cmd, index) => {
      if (index > 0) { // Keep first command as-is
        suggestions.push({
          type: 'rename',
          description: `Rename ${cmd.pluginName} command`,
          action: `Rename to ${conflictValue}-${cmd.pluginName.toLowerCase()}`,
          impact: 'medium',
          autoApplicable: false,
          confidence: 0.7
        });
      }
    });

    // Disable resolution
    if (commands.length > 2) {
      suggestions.push({
        type: 'disable',
        description: 'Disable lower priority commands',
        action: 'Keep highest priority, disable others',
        impact: 'high',
        autoApplicable: false,
        confidence: 0.6
      });
    }

    return suggestions;
  }

  /**
   * Computes the overall priority of a command based on plugin, category,
   * user overrides, command-specific priority, and registration time.
   *
   * @private
   * @param command - The command to evaluate.
   * @returns A numeric priority score; higher means more important.
   */
  private calculateCommandPriority(command: RegisteredCommand): number {
    let priority = this.resolutionPolicy.preserveSystemCommands && 
                  this.priorityConfig.systemCommands.has(command.definition.name) 
                  ? 10000 : 0;

    // User overrides have highest priority
    const userOverride = this.priorityConfig.userOverrides.get(command.id);
    if (userOverride !== undefined) {
      return priority + userOverride;
    }

    // Plugin-based priority
    const pluginPriority = this.priorityConfig.pluginPriorities.get(command.pluginName) || 
                          this.priorityConfig.defaultPriority;
    priority += pluginPriority;

    // Category-based priority
    if (command.definition.category) {
      const categoryPriority = this.priorityConfig.categoryPriorities.get(command.definition.category) || 0;
      priority += categoryPriority * 0.1; // Category has less weight than plugin
    }

    // Command-specific priority
    priority += command.definition.priority || 0;

    // Registration time (earlier = higher priority)
    priority += Math.max(0, 1000 - (Date.now() - command.registeredAt) / 1000);

    return priority;
  }

  /**
   * Computes the priority of a conflict as the highest priority among
   * its participating commands.
   *
   * @private
   * @param commands - The commands involved in the conflict.
   * @returns The highest individual command priority.
   */
  private calculateConflictPriority(commands: RegisteredCommand[]): number {
    const priorities = commands.map(cmd => this.calculateCommandPriority(cmd));
    return Math.max(...priorities);
  }

  /**
   * Resolves a single conflict using the given (or default) strategy.
   *
   * @param conflictId - The ID of the conflict to resolve.
   * @param strategy - Optional override strategy; defaults to the policy.
   * @param options - Optional flags controlling confirmation and dry-run behavior.
   * @returns A ConflictResolution describing the actions taken and their outcome.
   */
  async resolveConflict(
    conflictId: string,
    strategy?: ConflictResolutionStrategy,
    options: { userConfirmed?: boolean; dryRun?: boolean } = {}
  ): Promise<ConflictResolution> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new ValidationError(`Conflict '${conflictId}' not found`);
    }

    if (conflict.resolved) {
      throw new ValidationError(`Conflict '${conflictId}' already resolved`);
    }

    const resolveStrategy = strategy || 
                           this.resolutionPolicy.strategyByType.get(conflict.type) ||
                           this.resolutionPolicy.defaultStrategy;

    if (this.resolutionPolicy.requireConfirmation && !options.userConfirmed && !options.dryRun) {
      throw new ValidationError('User confirmation required for conflict resolution');
    }

    if (this.autoResolutionCount >= this.resolutionPolicy.maxAutoResolutions && !options.userConfirmed) {
      throw new ValidationError('Maximum auto-resolution limit reached');
    }

    const resolution: ConflictResolution = {
      strategy: resolveStrategy,
      appliedAt: Date.now(),
      appliedBy: options.userConfirmed ? 'user' : 'auto',
      actions: [],
      success: false,
      errors: [],
      reversible: true
    };

    this.emit('conflict-resolution-started', { conflictId, strategy: resolveStrategy });

    try {
      switch (resolveStrategy) {
        case ConflictResolutionStrategy.PRIORITY:
          resolution.actions = await this.resolveBypriority(conflict, options.dryRun);
          break;
        case ConflictResolutionStrategy.NAMESPACE:
          resolution.actions = await this.resolveByNamespace(conflict, options.dryRun);
          break;
        case ConflictResolutionStrategy.FIRST_WINS:
          resolution.actions = await this.resolveByFirstWins(conflict, options.dryRun);
          break;
        case ConflictResolutionStrategy.LAST_WINS:
          resolution.actions = await this.resolveByLastWins(conflict, options.dryRun);
          break;
        case ConflictResolutionStrategy.DISABLE_ALL:
          resolution.actions = await this.resolveByDisableAll(conflict, options.dryRun);
          break;
        default:
          throw new ValidationError(`Unsupported resolution strategy: ${resolveStrategy}`);
      }

      resolution.success = resolution.actions.every(action => action.applied);
      
      if (resolution.success && !options.dryRun) {
        conflict.resolved = true;
        conflict.resolution = resolution;
        this.autoResolutionCount++;
      }

      this.resolutionHistory.push(resolution);
      this.emit('conflict-resolved', { conflictId, resolution });

    } catch (error) {
      resolution.errors.push(error instanceof Error ? error.message : String(error));
      this.emit('conflict-resolution-failed', { conflictId, error });
    }

    return resolution;
  }

  /**
   * Resolves a conflict by keeping the highest-priority command and disabling the rest.
   *
   * @private
   * @param conflict - The conflict to resolve.
   * @param dryRun - When true, simulate without modifying commands.
   * @returns An array of actions taken during resolution.
   */
  private async resolveBypriority(
    conflict: CommandConflict,
    dryRun?: boolean
  ): Promise<ConflictResolutionAction[]> {
    const actions: ConflictResolutionAction[] = [];
    const commands = conflict.conflictingCommands.map(id => this.commands.get(id)!);
    
    // Sort by priority (highest first)
    const sortedCommands = commands.sort((a, b) => 
      this.calculateCommandPriority(b) - this.calculateCommandPriority(a)
    );

    // Keep highest priority, disable others
    for (let i = 1; i < sortedCommands.length; i++) {
      const action: ConflictResolutionAction = {
        type: 'disable',
        target: sortedCommands[i].id,
        details: { reason: 'lower priority in conflict resolution' },
        applied: false
      };

      if (!dryRun) {
        try {
          // In real implementation, would disable the command
          sortedCommands[i].isActive = false;
          action.applied = true;
        } catch (error) {
          action.error = error instanceof Error ? error.message : String(error);
        }
      } else {
        action.applied = true; // Assume success for dry run
      }

      actions.push(action);
    }

    return actions;
  }

  /**
   * Resolves a conflict by namespacing all but the first command.
   *
   * @private
   * @param conflict - The conflict to resolve.
   * @param dryRun - When true, simulate without modifying commands.
   * @returns An array of actions taken during resolution.
   */
  private async resolveByNamespace(
    conflict: CommandConflict,
    dryRun?: boolean
  ): Promise<ConflictResolutionAction[]> {
    const actions: ConflictResolutionAction[] = [];
    const commands = conflict.conflictingCommands.map(id => this.commands.get(id)!);

    for (let i = 1; i < commands.length; i++) { // Keep first command unchanged
      const cmd = commands[i];
      const newName = `${this.resolutionPolicy.namespacePrefix}:${cmd.pluginName}:${conflict.conflictValue}`;
      
      const action: ConflictResolutionAction = {
        type: 'namespace',
        target: cmd.id,
        details: { 
          originalName: conflict.conflictValue,
          newName,
          prefix: `${this.resolutionPolicy.namespacePrefix}:${cmd.pluginName}`
        },
        applied: false
      };

      if (!dryRun) {
        try {
          // In real implementation, would rename the command
          cmd.definition.name = newName;
          action.applied = true;
        } catch (error) {
          action.error = error instanceof Error ? error.message : String(error);
        }
      } else {
        action.applied = true;
      }

      actions.push(action);
    }

    return actions;
  }

  /**
   * Resolves a conflict by keeping the earliest-registered command.
   *
   * @private
   * @param conflict - The conflict to resolve.
   * @param dryRun - When true, simulate without modifying commands.
   * @returns An array of actions taken during resolution.
   */
  private async resolveByFirstWins(
    conflict: CommandConflict,
    dryRun?: boolean
  ): Promise<ConflictResolutionAction[]> {
    const actions: ConflictResolutionAction[] = [];
    const commands = conflict.conflictingCommands.map(id => this.commands.get(id)!);
    
    // Sort by registration time (earliest first)
    const sortedCommands = commands.sort((a, b) => a.registeredAt - b.registeredAt);

    // Disable all except first
    for (let i = 1; i < sortedCommands.length; i++) {
      const action: ConflictResolutionAction = {
        type: 'disable',
        target: sortedCommands[i].id,
        details: { reason: 'first-wins policy' },
        applied: false
      };

      if (!dryRun) {
        try {
          sortedCommands[i].isActive = false;
          action.applied = true;
        } catch (error) {
          action.error = error instanceof Error ? error.message : String(error);
        }
      } else {
        action.applied = true;
      }

      actions.push(action);
    }

    return actions;
  }

  /**
   * Resolves a conflict by keeping the latest-registered command.
   *
   * @private
   * @param conflict - The conflict to resolve.
   * @param dryRun - When true, simulate without modifying commands.
   * @returns An array of actions taken during resolution.
   */
  private async resolveByLastWins(
    conflict: CommandConflict,
    dryRun?: boolean
  ): Promise<ConflictResolutionAction[]> {
    const actions: ConflictResolutionAction[] = [];
    const commands = conflict.conflictingCommands.map(id => this.commands.get(id)!);
    
    // Sort by registration time (latest first)
    const sortedCommands = commands.sort((a, b) => b.registeredAt - a.registeredAt);

    // Disable all except last (first in sorted array)
    for (let i = 1; i < sortedCommands.length; i++) {
      const action: ConflictResolutionAction = {
        type: 'disable',
        target: sortedCommands[i].id,
        details: { reason: 'last-wins policy' },
        applied: false
      };

      if (!dryRun) {
        try {
          sortedCommands[i].isActive = false;
          action.applied = true;
        } catch (error) {
          action.error = error instanceof Error ? error.message : String(error);
        }
      } else {
        action.applied = true;
      }

      actions.push(action);
    }

    return actions;
  }

  /**
   * Resolves a conflict by disabling all participating commands.
   *
   * @private
   * @param conflict - The conflict to resolve.
   * @param dryRun - When true, simulate without modifying commands.
   * @returns An array of actions taken during resolution.
   */
  private async resolveByDisableAll(
    conflict: CommandConflict,
    dryRun?: boolean
  ): Promise<ConflictResolutionAction[]> {
    const actions: ConflictResolutionAction[] = [];
    const commands = conflict.conflictingCommands.map(id => this.commands.get(id)!);

    for (const cmd of commands) {
      const action: ConflictResolutionAction = {
        type: 'disable',
        target: cmd.id,
        details: { reason: 'disable-all policy' },
        applied: false
      };

      if (!dryRun) {
        try {
          cmd.isActive = false;
          action.applied = true;
        } catch (error) {
          action.error = error instanceof Error ? error.message : String(error);
        }
      } else {
        action.applied = true;
      }

      actions.push(action);
    }

    return actions;
  }

  /**
   * Automatically resolves all auto-resolvable conflicts up to the configured limit.
   *
   * @returns An array of resolutions produced during the run.
   */
  async autoResolveConflicts(): Promise<ConflictResolution[]> {
    if (!this.resolutionPolicy.allowAutoResolution) {
      throw new ValidationError('Auto-resolution is disabled');
    }

    const resolutions: ConflictResolution[] = [];
    const autoResolvableConflicts = Array.from(this.conflicts.values())
      .filter(c => !c.resolved && c.autoResolvable)
      .sort((a, b) => b.priority - a.priority); // Resolve highest priority first

    for (const conflict of autoResolvableConflicts) {
      if (this.autoResolutionCount >= this.resolutionPolicy.maxAutoResolutions) {
        break;
      }

      try {
        const resolution = await this.resolveConflict(conflict.id);
        resolutions.push(resolution);
      } catch (error) {
        this.emit('auto-resolution-failed', { conflictId: conflict.id, error });
      }
    }

    return resolutions;
  }

  /**
   * Normalizes an option flag string for comparison by trimming leading dashes and lowercasing.
   *
   * @private
   * @param flag - The raw flag string (e.g. "--verbose").
   * @returns The normalized flag (e.g. "verbose").
   */
  private normalizeFlag(flag: string): string {
    return flag.replace(/^-+/, '').toLowerCase();
  }

  /**
   * Returns all currently tracked conflicts.
   *
   * @returns An array of all conflicts.
   */
  getConflicts(): CommandConflict[] {
    return Array.from(this.conflicts.values());
  }

  /**
   * Returns all conflicts that have not yet been resolved.
   *
   * @returns An array of unresolved conflicts.
   */
  getUnresolvedConflicts(): CommandConflict[] {
    return Array.from(this.conflicts.values()).filter(c => !c.resolved);
  }

  /**
   * Returns all conflicts matching the given type.
   *
   * @param type - The conflict type to filter by.
   * @returns An array of conflicts of the specified type.
   */
  getConflictsByType(type: ConflictType): CommandConflict[] {
    return Array.from(this.conflicts.values()).filter(c => c.type === type);
  }

  /**
   * Returns all conflicts matching the given severity level.
   *
   * @param severity - The severity level to filter by.
   * @returns An array of conflicts at the specified severity.
   */
  getConflictsBySeverity(severity: ConflictSeverity): CommandConflict[] {
    return Array.from(this.conflicts.values()).filter(c => c.severity === severity);
  }

  /**
   * Returns a copy of the full resolution history.
   *
   * @returns An array of all past resolutions.
   */
  getResolutionHistory(): ConflictResolution[] {
    return [...this.resolutionHistory];
  }

  /**
   * Sets a user-defined priority override for a specific command.
   *
   * @param commandId - The ID of the command to override.
   * @param priority - The priority value to assign.
   */
  setUserPriorityOverride(commandId: string, priority: number): void {
    this.priorityConfig.userOverrides.set(commandId, priority);
    this.emit('priority-override-set', { commandId, priority });
  }

  /**
   * Removes a previously set user priority override for a command.
   *
   * @param commandId - The ID of the command whose override should be removed.
   */
  removeUserPriorityOverride(commandId: string): void {
    this.priorityConfig.userOverrides.delete(commandId);
    this.emit('priority-override-removed', { commandId });
  }

  /**
   * Computes and returns summary statistics about tracked conflicts and resolutions.
   *
   * @returns An object containing totals, breakdowns by type/severity, and resolution counts.
   */
  getStats(): any {
    const conflicts = Array.from(this.conflicts.values());
    
    return {
      total: conflicts.length,
      resolved: conflicts.filter(c => c.resolved).length,
      unresolved: conflicts.filter(c => !c.resolved).length,
      autoResolvable: conflicts.filter(c => c.autoResolvable && !c.resolved).length,
      byType: Object.values(ConflictType).reduce((acc, type) => {
        acc[type] = conflicts.filter(c => c.type === type).length;
        return acc;
      }, {} as Record<string, number>),
      bySeverity: Object.values(ConflictSeverity).reduce((acc, severity) => {
        acc[severity] = conflicts.filter(c => c.severity === severity).length;
        return acc;
      }, {} as Record<string, number>),
      resolutionHistory: this.resolutionHistory.length,
      autoResolutionCount: this.autoResolutionCount,
      priorityOverrides: this.priorityConfig.userOverrides.size
    };
  }
}

/**
 * Factory that creates a new CommandConflictResolver with optional configuration overrides.
 *
 * @param priorityConfig - Optional partial overrides for priority configuration.
 * @param resolutionPolicy - Optional partial overrides for the resolution policy.
 * @returns A configured CommandConflictResolver instance.
 */
export function createConflictResolver(
  priorityConfig?: Partial<PriorityConfig>,
  resolutionPolicy?: Partial<ConflictResolutionPolicy>
): CommandConflictResolver {
  return new CommandConflictResolver(priorityConfig, resolutionPolicy);
}

/**
 * Returns the chalk color name associated with a given conflict severity level.
 *
 * @param severity - The severity level to look up.
 * @returns A color name suitable for use with chalk (e.g. "red", "yellow").
 */
export function getConflictSeverityColor(severity: ConflictSeverity): string {
  switch (severity) {
    case ConflictSeverity.CRITICAL: return 'red';
    case ConflictSeverity.HIGH: return 'magenta';
    case ConflictSeverity.MEDIUM: return 'yellow';
    case ConflictSeverity.LOW: return 'blue';
    default: return 'gray';
  }
}

/**
 * Converts a kebab-case ConflictType value into a human-readable, title-cased label.
 *
 * @param type - The conflict type to format.
 * @returns A formatted string (e.g. "Command Name" for "command-name").
 */
export function formatConflictType(type: ConflictType): string {
  return type.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}