import { describe, it, expect } from 'vitest';
import { Command } from 'commander';

import {
  ConflictType,
  ConflictSeverity,
  ConflictResolutionStrategy,
  CommandConflictResolver,
  createConflictResolver,
  getConflictSeverityColor,
  formatConflictType,
  type PriorityConfig,
} from '../../src/utils/plugin-command-conflicts';
import type { RegisteredCommand } from '../../src/utils/plugin-command-registry';

function makeCommand(
  id: string,
  pluginName: string,
  name: string,
  aliases: string[] = [],
  category = 'utility'
): RegisteredCommand {
  const cmd = new Command(name);
  for (const a of aliases) cmd.alias(a);
  return {
    id,
    pluginName,
    definition: {
      name,
      description: '',
      aliases,
      arguments: [],
      options: [],
      category,
      handler: async () => {},
    } as any,
    commanderCommand: cmd,
    registeredAt: Date.now(),
    usageCount: 0,
    isActive: true,
    conflicts: [],
  };
}

describe('plugin-command-conflicts', () => {
  describe('enums', () => {
    it('exposes the expected ConflictType values', () => {
      expect(ConflictType.COMMAND_NAME).toBe('command-name');
      expect(ConflictType.ALIAS).toBe('alias');
      expect(ConflictType.SUBCOMMAND).toBe('subcommand');
      expect(ConflictType.OPTION).toBe('option');
      expect(ConflictType.DESCRIPTION).toBe('description');
    });

    it('exposes the expected ConflictSeverity ordering', () => {
      expect(ConflictSeverity.LOW).toBe('low');
      expect(ConflictSeverity.MEDIUM).toBe('medium');
      expect(ConflictSeverity.HIGH).toBe('high');
      expect(ConflictSeverity.CRITICAL).toBe('critical');
    });

    it('exposes the canonical ConflictResolutionStrategy set', () => {
      expect(ConflictResolutionStrategy.FIRST_WINS).toBe('first-wins');
      expect(ConflictResolutionStrategy.LAST_WINS).toBe('last-wins');
      expect(ConflictResolutionStrategy.PRIORITY).toBe('priority');
      expect(ConflictResolutionStrategy.NAMESPACE).toBe('namespace');
      expect(ConflictResolutionStrategy.INTERACTIVE).toBe('interactive');
      expect(ConflictResolutionStrategy.AUTO_MERGE).toBe('auto-merge');
      expect(ConflictResolutionStrategy.DISABLE_ALL).toBe('disable-all');
    });
  });

  describe('formatConflictType', () => {
    it('converts a single-word type to title case', () => {
      expect(formatConflictType('alias')).toBe('Alias');
    });

    it('converts a kebab-case type to title-cased words', () => {
      expect(formatConflictType(ConflictType.COMMAND_NAME)).toBe('Command Name');
    });

    it('handles multi-hyphen types', () => {
      expect(formatConflictType('very-long-type')).toBe('Very Long Type');
    });
  });

  describe('getConflictSeverityColor', () => {
    it('maps CRITICAL to red', () => {
      expect(getConflictSeverityColor(ConflictSeverity.CRITICAL)).toBe('red');
    });

    it('maps HIGH to magenta', () => {
      expect(getConflictSeverityColor(ConflictSeverity.HIGH)).toBe('magenta');
    });

    it('maps MEDIUM to yellow', () => {
      expect(getConflictSeverityColor(ConflictSeverity.MEDIUM)).toBe('yellow');
    });

    it('maps LOW to blue', () => {
      expect(getConflictSeverityColor(ConflictSeverity.LOW)).toBe('blue');
    });

    it('falls back to gray for unknown severity', () => {
      expect(getConflictSeverityColor('unknown' as any)).toBe('gray');
    });
  });

  describe('createConflictResolver', () => {
    it('returns a CommandConflictResolver instance', () => {
      const r = createConflictResolver();
      expect(r).toBeInstanceOf(CommandConflictResolver);
    });

    it('accepts partial priorityConfig and resolutionPolicy', () => {
      const customPriorities: Partial<PriorityConfig> = {
        defaultPriority: 250,
      };
      const r = createConflictResolver(customPriorities, {
        namespacePrefix: 'plug',
      });
      expect(r).toBeInstanceOf(CommandConflictResolver);
    });
  });

  describe('CommandConflictResolver', () => {
    it('emits priority-override-set when setUserPriorityOverride is called', () => {
      const resolver = new CommandConflictResolver();
      const events: Array<{ commandId: string; priority: number }> = [];
      resolver.on('priority-override-set', payload => events.push(payload));

      resolver.setUserPriorityOverride('plugin:cmd', 500);
      expect(events).toEqual([{ commandId: 'plugin:cmd', priority: 500 }]);
    });

    it('emits priority-override-removed when removeUserPriorityOverride is called', () => {
      const resolver = new CommandConflictResolver();
      const events: Array<{ commandId: string }> = [];
      resolver.on('priority-override-removed', payload => events.push(payload));

      resolver.removeUserPriorityOverride('plugin:cmd');
      expect(events).toEqual([{ commandId: 'plugin:cmd' }]);
    });

    it('starts with empty conflict list and empty resolution history', () => {
      const resolver = new CommandConflictResolver();
      expect(resolver.getConflicts()).toEqual([]);
      expect(resolver.getResolutionHistory()).toEqual([]);
    });

    it('detects a command-name conflict when two plugins share a name', () => {
      const resolver = new CommandConflictResolver();
      const a = makeCommand('p1:build', 'p1', 'build');
      const b = makeCommand('p2:build', 'p2', 'build');
      resolver.registerCommands([a, b]);

      const nameConflicts = resolver.getConflictsByType(ConflictType.COMMAND_NAME);
      expect(nameConflicts.length).toBeGreaterThan(0);
      expect(nameConflicts[0].type).toBe(ConflictType.COMMAND_NAME);
    });

    it('detects an alias conflict when aliases collide', () => {
      const resolver = new CommandConflictResolver();
      const a = makeCommand('p1:install', 'p1', 'install', ['i']);
      const b = makeCommand('p2:info', 'p2', 'info', ['i']);
      resolver.registerCommands([a, b]);

      const aliasConflicts = resolver.getConflictsByType(ConflictType.ALIAS);
      expect(aliasConflicts.length).toBeGreaterThan(0);
    });

    it('does not report conflicts for distinct command names and aliases', () => {
      const resolver = new CommandConflictResolver();
      const a = makeCommand('p1:alpha', 'p1', 'alpha', ['a']);
      const b = makeCommand('p2:beta', 'p2', 'beta', ['b']);
      resolver.registerCommands([a, b]);

      expect(resolver.getConflicts()).toEqual([]);
    });

    it('getConflictsBySeverity filters correctly', () => {
      const resolver = new CommandConflictResolver();
      const a = makeCommand('p1:help', 'core', 'help');
      const b = makeCommand('p2:help', 'community', 'help');
      resolver.registerCommands([a, b]);

      const all = resolver.getConflicts();
      const critical = resolver.getConflictsBySeverity(ConflictSeverity.CRITICAL);
      expect(critical.every(c => c.severity === ConflictSeverity.CRITICAL)).toBe(true);
      expect(critical.length).toBeLessThanOrEqual(all.length);
    });

    it('getUnresolvedConflicts only returns conflicts with resolved=false', () => {
      const resolver = new CommandConflictResolver();
      resolver.registerCommands([
        makeCommand('p1:build', 'p1', 'build'),
        makeCommand('p2:build', 'p2', 'build'),
      ]);

      const unresolved = resolver.getUnresolvedConflicts();
      expect(unresolved.length).toBeGreaterThan(0);
      expect(unresolved.every(c => !c.resolved)).toBe(true);
    });

    it('getStats returns counts and breakdowns', () => {
      const resolver = new CommandConflictResolver();
      resolver.registerCommands([
        makeCommand('p1:build', 'p1', 'build'),
        makeCommand('p2:build', 'p2', 'build'),
      ]);

      const stats = resolver.getStats();
      expect(typeof stats.total).toBe('number');
      expect(stats.total).toBeGreaterThan(0);
      expect(typeof stats.resolved).toBe('number');
      expect(typeof stats.unresolved).toBe('number');
    });
  });
});
