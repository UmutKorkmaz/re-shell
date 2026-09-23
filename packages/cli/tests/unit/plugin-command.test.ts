import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listPluginCommands,
  showCommandConflicts,
  resolveCommandConflicts,
  showCommandStats,
  registerTestCommand,
  unregisterCommand,
  showCommandInfo,
} from '../../src/commands/plugin-command';
import { ValidationError } from '../../src/utils/error-handler';
import type { PluginCommandDefinition } from '../../src/utils/plugin-command-registry';
import type { PluginRegistration } from '../../src/utils/plugin-system';

// Covers src/commands/plugin-command.ts — the plugin command management
// surface (list / conflicts / resolve / stats / register / unregister / info).
// The plugin registry (plugin-system) and the command registry
// (plugin-command-registry) are mocked; each test scripts what the registries
// return so every render branch is exercised deterministically.

const mocks = vi.hoisted(() => {
  interface ScriptedRegistry {
    [key: string]: unknown;
  }
  return {
    pluginRegistry: {
      initialize: vi.fn(async () => undefined),
      getPlugin: vi.fn(),
    },
    commandRegistry: {
      initialize: vi.fn(async () => undefined),
      getCommands: vi.fn(),
      getConflicts: vi.fn(),
      getStats: vi.fn(),
      getCommand: vi.fn(),
      resolveConflicts: vi.fn(),
      registerCommand: vi.fn(),
      unregisterCommand: vi.fn(),
    } as ScriptedRegistry,
  };
});

vi.mock('../../src/utils/plugin-system', () => ({
  createPluginRegistry: vi.fn(() => mocks.pluginRegistry),
}));
vi.mock('../../src/utils/plugin-command-registry', () => ({
  createPluginCommandRegistry: vi.fn(() => mocks.commandRegistry),
}));
vi.mock('../../src/utils/spinner', () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
}));

let logSpy: ReturnType<typeof vi.spyOn>;

function makeCommand(overrides: Partial<RegisteredLike> = {}): RegisteredLike {
  return {
    id: 'demo-plugin:build',
    pluginName: 'demo-plugin',
    definition: {
      name: 'build',
      description: 'Builds the demo workspace',
      aliases: ['b'],
      category: 'build',
      priority: 5,
      handler: () => undefined,
    },
    isActive: true,
    usageCount: 3,
    registeredAt: Date.now(),
    lastUsed: Date.now(),
    conflicts: [],
    ...overrides,
  };
}

interface RegisteredLike {
  id: string;
  pluginName: string;
  definition: PluginCommandDefinition & {
    category?: string;
    priority?: number;
  };
  isActive: boolean;
  usageCount: number;
  registeredAt: number;
  lastUsed?: number;
  conflicts: string[];
}

function output(): string {
  return logSpy.mock.calls.map(c => String(c[0])).join('\n');
}

describe('plugin-command — command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.commandRegistry.getCommands.mockReturnValue([]);
    mocks.commandRegistry.getConflicts.mockReturnValue(new Map());
    mocks.commandRegistry.getStats.mockReturnValue({
      totalCommands: 0,
      activeCommands: 0,
      totalAliases: 0,
      totalConflicts: 0,
      commandsByPlugin: {},
      mostUsedCommands: [],
      recentCommands: [],
    });
    mocks.commandRegistry.getCommand.mockReturnValue(undefined);
  });

  describe('listPluginCommands', () => {
    it('lists commands grouped by plugin with summary', async () => {
      mocks.commandRegistry.getCommands.mockReturnValue([
        makeCommand(),
        makeCommand({ id: 'demo-plugin:test', definition: { ...makeCommand().definition, name: 'test' } }),
        makeCommand({ id: 'other:deploy', pluginName: 'other', isActive: false, conflicts: ['x:build'] }),
      ]);
      await listPluginCommands();
      const out = output();
      expect(out).toContain('Registered Plugin Commands');
      expect(out).toContain('demo-plugin (2 commands)');
      expect(out).toContain('other (1 commands)');
      expect(out).toContain('Total commands: 3');
      expect(out).toContain('Active: 2');
      expect(out).toContain('Inactive: 1');
      expect(out).toContain('Conflicts: 1');
    });

    it('renders conflict and deprecated badges', async () => {
      mocks.commandRegistry.getCommands.mockReturnValue([
        makeCommand({
          conflicts: ['other:build'],
          definition: { ...makeCommand().definition, deprecated: true },
        }),
      ]);
      await listPluginCommands();
      expect(output()).toContain('[CONFLICT]');
      expect(output()).toContain('[DEPRECATED]');
    });

    it('prints verbose metadata lines', async () => {
      mocks.commandRegistry.getCommands.mockReturnValue([makeCommand()]);
      await listPluginCommands({ verbose: true });
      const out = output();
      expect(out).toContain('Usage: 3 times');
      expect(out).toContain('Category: build');
      expect(out).toContain('Priority: 5');
      expect(out).toContain('Aliases: b');
    });

    it('filters by plugin, category, active and conflicts', async () => {
      const commands = [
        makeCommand(),
        makeCommand({ id: 'other:deploy', pluginName: 'other', isActive: false, definition: { ...makeCommand().definition, name: 'deploy', category: 'deploy' } }),
      ];
      mocks.commandRegistry.getCommands.mockReturnValue(commands);

      await listPluginCommands({ plugin: 'demo-plugin' });
      expect(output()).toContain('demo-plugin (1 commands)');
      expect(output()).not.toContain('other (');

      logSpy.mockClear();
      await listPluginCommands({ category: 'deploy' });
      expect(output()).toContain('other (1 commands)');

      logSpy.mockClear();
      await listPluginCommands({ active: false });
      expect(output()).toContain('other (1 commands)');

      logSpy.mockClear();
      await listPluginCommands({ conflicts: true });
      expect(output()).toContain('No plugin commands found matching criteria.');
    });

    it('emits JSON when requested', async () => {
      mocks.commandRegistry.getCommands.mockReturnValue([makeCommand()]);
      await listPluginCommands({ json: true });
      const payload = JSON.parse(output());
      expect(payload).toHaveLength(1);
      expect(payload[0].id).toBe('demo-plugin:build');
    });

    it('reports the empty state', async () => {
      await listPluginCommands();
      expect(output()).toContain('No plugin commands found matching criteria.');
    });

    it('wraps registry failures in ValidationError', async () => {
      mocks.commandRegistry.getCommands.mockImplementation(() => {
        throw new Error('boom');
      });
      await expect(listPluginCommands()).rejects.toThrow(ValidationError);
      await expect(listPluginCommands()).rejects.toThrow('Failed to list plugin commands: boom');
    });
  });

  describe('showCommandConflicts', () => {
    it('reports the clean state', async () => {
      await showCommandConflicts();
      expect(output()).toContain('No command conflicts detected.');
    });

    it('renders multi-registration conflicts with resolution suggestions', async () => {
      const cmdA = makeCommand();
      const cmdB = makeCommand({ id: 'other:build', pluginName: 'other' });
      mocks.commandRegistry.getConflicts.mockReturnValue(
        new Map([['build', [cmdA.id, cmdB.id]]])
      );
      mocks.commandRegistry.getCommand.mockImplementation(
        (id: string) => (id === cmdA.id ? cmdA : id === cmdB.id ? cmdB : undefined)
      );
      await showCommandConflicts();
      const out = output();
      expect(out).toContain('Command: build');
      expect(out).toContain('2 conflicting registrations');
      expect(out).toContain('demo-plugin:build (demo-plugin)');
      expect(out).toContain('Resolution suggestions');
    });

    it('emits the conflicts map as JSON', async () => {
      mocks.commandRegistry.getConflicts.mockReturnValue(
        new Map([['build', ['a:build', 'b:build']]])
      );
      await showCommandConflicts({ json: true });
      expect(JSON.parse(output())).toEqual({ build: ['a:build', 'b:build'] });
    });

    it('wraps failures in ValidationError', async () => {
      mocks.commandRegistry.getConflicts.mockImplementation(() => {
        throw new Error('conflict boom');
      });
      await expect(showCommandConflicts()).rejects.toThrow(
        'Failed to show command conflicts: conflict boom'
      );
    });
  });

  describe('resolveCommandConflicts', () => {
    it('reports success', async () => {
      mocks.commandRegistry.resolveConflicts.mockResolvedValueOnce(true);
      await resolveCommandConflicts('build', 'priority');
      expect(output()).toContain("Successfully resolved conflicts for 'build'");
      expect(mocks.commandRegistry.resolveConflicts).toHaveBeenCalledWith('build', 'priority');
    });

    it('reports failure', async () => {
      mocks.commandRegistry.resolveConflicts.mockResolvedValueOnce(false);
      await resolveCommandConflicts('build', 'disable');
      expect(output()).toContain("Failed to resolve conflicts for 'build'");
    });

    it('prints resolution details in verbose mode', async () => {
      mocks.commandRegistry.resolveConflicts.mockResolvedValueOnce(true);
      const cmdA = makeCommand();
      const cmdB = makeCommand({ id: 'other:build', pluginName: 'other', isActive: false });
      mocks.commandRegistry.getConflicts.mockReturnValue(
        new Map([['build', [cmdA.id, cmdB.id]]])
      );
      mocks.commandRegistry.getCommand.mockImplementation(
        (id: string) => (id === cmdA.id ? cmdA : id === cmdB.id ? cmdB : undefined)
      );
      await resolveCommandConflicts('build', 'priority', { verbose: true });
      const out = output();
      expect(out).toContain('Resolution details');
      expect(out).toContain('demo-plugin:build: active');
      expect(out).toContain('other:build: disabled');
    });

    it('wraps failures in ValidationError', async () => {
      mocks.commandRegistry.resolveConflicts.mockRejectedValueOnce(new Error('nope'));
      await expect(resolveCommandConflicts('build', 'priority')).rejects.toThrow(
        'Failed to resolve command conflicts: nope'
      );
    });
  });

  describe('showCommandStats', () => {
    it('renders the overview', async () => {
      mocks.commandRegistry.getStats.mockReturnValue({
        totalCommands: 5,
        activeCommands: 4,
        totalAliases: 2,
        totalConflicts: 1,
        commandsByPlugin: { 'demo-plugin': 3, other: 2 },
        mostUsedCommands: [],
        recentCommands: [],
      });
      await showCommandStats();
      const out = output();
      expect(out).toContain('Total commands: 5');
      expect(out).toContain('Active commands: 4');
      expect(out).toContain('Inactive commands: 1');
      expect(out).toContain('Total aliases: 2');
      expect(out).toContain('Command conflicts: 1');
      expect(out).toContain('demo-plugin: 3');
      expect(out).toContain('other: 2');
    });

    it('renders usage sections when --usage is set', async () => {
      mocks.commandRegistry.getStats.mockReturnValue({
        totalCommands: 1,
        activeCommands: 1,
        totalAliases: 0,
        totalConflicts: 0,
        commandsByPlugin: {},
        mostUsedCommands: [{ name: 'build', plugin: 'demo-plugin', usageCount: 9 }],
        recentCommands: [{ name: 'build', plugin: 'demo-plugin', lastUsed: Date.now() }],
      });
      await showCommandStats({ usage: true });
      const out = output();
      expect(out).toContain('Most Used Commands');
      expect(out).toContain('build (demo-plugin): 9 times');
      expect(out).toContain('Recently Used Commands');
    });

    it('renders the verbose configuration block', async () => {
      await showCommandStats({ verbose: true });
      const out = output();
      expect(out).toContain('Registry Configuration');
      expect(out).toContain('Conflict resolution: priority');
      expect(out).toContain('Usage tracking: true');
    });

    it('emits stats as JSON', async () => {
      mocks.commandRegistry.getStats.mockReturnValue({ totalCommands: 1 });
      await showCommandStats({ json: true });
      expect(JSON.parse(output())).toEqual({ totalCommands: 1 });
    });

    it('wraps failures in ValidationError', async () => {
      mocks.commandRegistry.getStats.mockImplementation(() => {
        throw new Error('stats boom');
      });
      await expect(showCommandStats()).rejects.toThrow(
        'Failed to show command statistics: stats boom'
      );
    });
  });

  describe('registerTestCommand', () => {
    const plugin: PluginRegistration = {
      manifest: { name: 'demo-plugin', version: '1.0.0', description: 'demo', main: 'dist/index.js' },
      pluginPath: '/plugins/demo-plugin',
      isLoaded: true,
      isActive: true,
      usageCount: 0,
    };
    const definition = {
      name: 'build',
      description: 'Builds the workspace',
      handler: '() => undefined',
    };

    it('registers a valid definition and prints the command id', async () => {
      mocks.pluginRegistry.getPlugin.mockReturnValueOnce(plugin);
      mocks.commandRegistry.registerCommand.mockResolvedValueOnce({
        success: true,
        commandId: 'demo-plugin:build',
        warnings: ['alias already in use'],
        conflicts: ['other:build'],
        errors: [],
      });
      await registerTestCommand('demo-plugin', JSON.stringify(definition), { verbose: true });
      const out = output();
      expect(out).toContain("Successfully registered command 'build'");
      expect(out).toContain('Command ID: demo-plugin:build');
      expect(out).toContain('Warnings:');
      expect(out).toContain('alias already in use');
      expect(out).toContain('Conflicts detected');
    });

    it('reports registration failures with errors', async () => {
      mocks.pluginRegistry.getPlugin.mockReturnValueOnce(plugin);
      mocks.commandRegistry.registerCommand.mockResolvedValueOnce({
        success: false,
        commandId: 'demo-plugin:build',
        warnings: [],
        conflicts: [],
        errors: ['invalid name'],
      });
      await registerTestCommand('demo-plugin', JSON.stringify(definition));
      const out = output();
      expect(out).toContain("Failed to register command 'build'");
      expect(out).toContain('Errors:');
      expect(out).toContain('invalid name');
    });

    it('rejects non-JSON definitions', async () => {
      await expect(registerTestCommand('demo-plugin', '{not json')).rejects.toThrow(
        'Command definition must be valid JSON'
      );
    });

    it('rejects unknown plugins', async () => {
      mocks.pluginRegistry.getPlugin.mockReturnValueOnce(undefined);
      await expect(
        registerTestCommand('ghost', JSON.stringify(definition))
      ).rejects.toThrow("Plugin 'ghost' not found");
    });

    it('wraps unexpected failures in ValidationError', async () => {
      mocks.pluginRegistry.getPlugin.mockReturnValueOnce(plugin);
      mocks.commandRegistry.registerCommand.mockRejectedValueOnce(new Error('registry down'));
      await expect(
        registerTestCommand('demo-plugin', JSON.stringify(definition))
      ).rejects.toThrow('Failed to register test command: registry down');
    });
  });

  describe('unregisterCommand', () => {
    it('unregisters a known command', async () => {
      mocks.commandRegistry.getCommand.mockReturnValueOnce(makeCommand());
      mocks.commandRegistry.unregisterCommand.mockResolvedValueOnce(true);
      await unregisterCommand('demo-plugin:build', { verbose: true });
      const out = output();
      expect(out).toContain("Successfully unregistered command 'demo-plugin:build'");
      expect(out).toContain('Usage count: 3');
    });

    it('warns for unknown commands', async () => {
      await unregisterCommand('ghost:cmd');
      expect(output()).toContain("Command 'ghost:cmd' not found");
      expect(mocks.commandRegistry.unregisterCommand).not.toHaveBeenCalled();
    });

    it('reports unregistration failures', async () => {
      mocks.commandRegistry.getCommand.mockReturnValueOnce(makeCommand());
      mocks.commandRegistry.unregisterCommand.mockResolvedValueOnce(false);
      await unregisterCommand('demo-plugin:build');
      expect(output()).toContain("Failed to unregister command 'demo-plugin:build'");
    });

    it('wraps failures in ValidationError', async () => {
      mocks.commandRegistry.getCommand.mockImplementation(() => {
        throw new Error('unregister boom');
      });
      await expect(unregisterCommand('demo-plugin:build')).rejects.toThrow(
        'Failed to unregister command: unregister boom'
      );
    });
  });

  describe('showCommandInfo', () => {
    it('renders full command details', async () => {
      const command = makeCommand({
        definition: {
          ...makeCommand().definition,
          arguments: [{ name: 'target', description: 'Build target', required: true, type: 'string', choices: ['all', 'app'], defaultValue: 'all' }],
          options: [{ flag: '--watch', description: 'Watch mode', required: false, type: 'boolean', defaultValue: false }],
          examples: ['re-shell plugin command demo build --watch'],
          hidden: true,
          deprecated: false,
          permission: 'build:run',
        },
      });
      mocks.commandRegistry.getCommand.mockReturnValueOnce(command);
      await showCommandInfo('demo-plugin:build', { verbose: true });
      const out = output();
      expect(out).toContain('Command Information: build');
      expect(out).toContain('Name: build');
      expect(out).toContain('Plugin: demo-plugin');
      expect(out).toContain('Status: Active');
      expect(out).toContain('Arguments:');
      expect(out).toContain('target (required): Build target');
      expect(out).toContain('Choices: all, app');
      expect(out).toContain('Default: all');
      expect(out).toContain('Options:');
      expect(out).toContain('--watch (optional): Watch mode');
      expect(out).toContain('Examples:');
      expect(out).toContain('Usage count: 3');
      expect(out).toContain('Hidden: true');
      expect(out).toContain('Permission: build:run');
    });

    it('renders conflicts with plugin attribution', async () => {
      const command = makeCommand({ conflicts: ['other:build'] });
      const other = makeCommand({ id: 'other:build', pluginName: 'other' });
      mocks.commandRegistry.getCommand.mockImplementation(
        (id: string) => (id === 'other:build' ? other : command)
      );
      await showCommandInfo('demo-plugin:build');
      const out = output();
      expect(out).toContain('Conflicts:');
      expect(out).toContain('other:build (other)');
    });

    it('warns for unknown commands', async () => {
      await showCommandInfo('ghost:cmd');
      expect(output()).toContain("Command 'ghost:cmd' not found");
    });

    it('emits the command as JSON', async () => {
      mocks.commandRegistry.getCommand.mockReturnValueOnce(makeCommand());
      await showCommandInfo('demo-plugin:build', { json: true });
      expect(JSON.parse(output()).id).toBe('demo-plugin:build');
    });

    it('wraps failures in ValidationError', async () => {
      mocks.commandRegistry.getCommand.mockImplementation(() => {
        throw new Error('info boom');
      });
      await expect(showCommandInfo('demo-plugin:build')).rejects.toThrow(
        'Failed to show command information: info boom'
      );
    });
  });
});
