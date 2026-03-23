import { EventEmitter } from 'events';
import chalk from 'chalk';
import { ValidationError } from './error-handler';
import { RegisteredCommand } from './plugin-command-registry';

// Conflict resolution strategies
export enum ConflictResolutionStrategy {
  FIRST_WINS = 'first-wins',
  LAST_WINS = 'last-wins',
  PRIORITY = 'priority',
  NAMESPACE = 'namespace',
  INTERACTIVE = 'interactive',
  AUTO_MERGE = 'auto-merge',
  DISABLE_ALL = 'disable-all'
}

// Conflict types
export enum ConflictType {
  COMMAND_NAME = 'command-name',
  ALIAS = 'alias',
  SUBCOMMAND = 'subcommand',
  OPTION = 'option',
  DESCRIPTION = 'description'
}

// Conflict severity levels
export enum ConflictSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Command conflict information
export interface CommandConflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  conflictingCommands: string[];
  conflictingPlugins: string[];
  conflictValue: string;
  description: string;
  suggestions: ConflictSuggestion[];
  autoResolvable: boolean;
  priority: number;
  detectedAt: number;
  resolved: boolean;
  resolution?: ConflictResolution;
}

// Conflict suggestion
export interface ConflictSuggestion {
  type: 'rename' | 'namespace' | 'disable' | 'merge' | 'priority';
  description: string;
  action: string;
  impact: 'low' | 'medium' | 'high';
  autoApplicable: boolean;
  confidence: number;
}

// Conflict resolution result
export interface ConflictResolution {
  strategy: ConflictResolutionStrategy;
  appliedAt: number;
  appliedBy: 'user' | 'auto';
  actions: ConflictResolutionAction[];
  success: boolean;
  errors: string[];
  reversible: boolean;
}

// Conflict resolution action
export interface ConflictResolutionAction {
  type: 'rename' | 'disable' | 'namespace' | 'priority' | 'merge';
  target: string; // command ID
  details: Record<string, any>;
  applied: boolean;
  error?: string;
}

// Priority configuration
export interface PriorityConfig {
  pluginPriorities: Map<string, number>;
  categoryPriorities: Map<string, number>;
  defaultPriority: number;
  userOverrides: Map<string, number>;
  systemCommands: Set<string>;
}

// Conflict resolution policy
export interface ConflictResolutionPolicy {
  defaultStrategy: ConflictResolutionStrategy;
  strategyByType: Map<ConflictType, ConflictResolutionStrategy>;
  allowAutoResolution: boolean;
  requireConfirmation: boolean;
  maxAutoResolutions: number;
  preserveSystemCommands: boolean;
  namespacePrefix?: string;
}

// Command conflict resolver
export class CommandConflictResolver extends EventEmitter {
  private conflicts: Map<string, CommandConflict> = new Map();
  private commands: Map<string, RegisteredCommand> = new Map();
  private priorityConfig: PriorityConfig;
  private resolutionPolicy: ConflictResolutionPolicy;
  private resolutionHistory: ConflictResolution[] = [];
  private autoResolutionCount = 0;

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

  // Register commands for conflict detection
  registerCommands(commands: RegisteredCommand[]): void {
    this.commands.clear();
    commands.forEach(cmd => {
      this.commands.set(cmd.id, cmd);
    });
    
    this.detectConflicts();
  }

  // Detect all conflicts
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

  // Detect command name conflicts
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

  // Detect alias conflicts
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

  // Detect option conflicts within commands
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

  // Create command name conflict
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

  // Create alias conflict
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

  // Create option conflict
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

  // Generate conflict suggestions
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

  // Calculate command priority
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

  // Calculate conflict priority
  private calculateConflictPriority(commands: RegisteredCommand[]): number {
    const priorities = commands.map(cmd => this.calculateCommandPriority(cmd));
    return Math.max(...priorities);
  }

  // Resolve conflict
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

  // Resolve by priority
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

  // Resolve by namespace
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

  // Resolve by first wins
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

  // Resolve by last wins
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

  // Resolve by disabling all
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

  // Auto-resolve all resolvable conflicts
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

  // Normalize flag for comparison
  private normalizeFlag(flag: string): string {
    return flag.replace(/^-+/, '').toLowerCase();
  }

  // Get all conflicts
  getConflicts(): CommandConflict[] {
    return Array.from(this.conflicts.values());
  }

  // Get unresolved conflicts
  getUnresolvedConflicts(): CommandConflict[] {
    return Array.from(this.conflicts.values()).filter(c => !c.resolved);
  }

  // Get conflicts by type
  getConflictsByType(type: ConflictType): CommandConflict[] {
    return Array.from(this.conflicts.values()).filter(c => c.type === type);
  }

  // Get conflicts by severity
  getConflictsBySeverity(severity: ConflictSeverity): CommandConflict[] {
    return Array.from(this.conflicts.values()).filter(c => c.severity === severity);
  }

  // Get resolution history
  getResolutionHistory(): ConflictResolution[] {
    return [...this.resolutionHistory];
  }

  // Set user priority override
  setUserPriorityOverride(commandId: string, priority: number): void {
    this.priorityConfig.userOverrides.set(commandId, priority);
    this.emit('priority-override-set', { commandId, priority });
  }

  // Remove user priority override
  removeUserPriorityOverride(commandId: string): void {
    this.priorityConfig.userOverrides.delete(commandId);
    this.emit('priority-override-removed', { commandId });
  }

  // Get conflict statistics
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

// Utility functions
export function createConflictResolver(
  priorityConfig?: Partial<PriorityConfig>,
  resolutionPolicy?: Partial<ConflictResolutionPolicy>
): CommandConflictResolver {
  return new CommandConflictResolver(priorityConfig, resolutionPolicy);
}

export function getConflictSeverityColor(severity: ConflictSeverity): string {
  switch (severity) {
    case ConflictSeverity.CRITICAL: return 'red';
    case ConflictSeverity.HIGH: return 'magenta';
    case ConflictSeverity.MEDIUM: return 'yellow';
    case ConflictSeverity.LOW: return 'blue';
    default: return 'gray';
  }
}

export function formatConflictType(type: ConflictType): string {
  return type.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}