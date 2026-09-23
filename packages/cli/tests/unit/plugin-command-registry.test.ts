import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import {
  PluginCommandRegistry,
  createPluginCommandRegistry,
  validateCommandName,
  normalizeCommandName,
  type PluginCommandDefinition,
  type CommandRegistryConfig,
} from '../../src/utils/plugin-command-registry';
import { ValidationError } from '../../src/utils/error-handler';
import type { PluginRegistration } from '../../src/utils/plugin-system';

/**
 * plugin-command-registry is a Commander-backed registry for plugin-provided
 * commands. We exercise the pure naming helpers, the lifecycle/initialization
 * events, registration (success + validation failures), lookup, conflict
 * tracking/resolution, and aggregated stats — all against real Commander
 * programs (duplicates are allowed by Commander, so same-name conflicts register).
 */

function makePlugin(name = 'test-plugin'): PluginRegistration {
  return { manifest: { name } } as unknown as PluginRegistration;
}

function makeDefinition(overrides: Partial<PluginCommandDefinition> = {}): PluginCommandDefinition {
  return {
    name: 'build',
    description: 'Builds the workspace',
    handler: vi.fn(),
    ...overrides,
  } as PluginCommandDefinition;
}

async function makeReadyRegistry(config?: Partial<CommandRegistryConfig>): Promise<PluginCommandRegistry> {
  const registry = new PluginCommandRegistry(new Command(), config);
  await registry.initialize();
  return registry;
}

describe('validateCommandName', () => {
  it('accepts lowercase names with letters, numbers and hyphens', () => {
    expect(validateCommandName('build')).toBe(true);
    expect(validateCommandName('build-all')).toBe(true);
    expect(validateCommandName('cmd1')).toBe(true);
    expect(validateCommandName('a')).toBe(true);
  });

  it('rejects uppercase letters', () => {
    expect(validateCommandName('Build')).toBe(false);
    expect(validateCommandName('buildAll')).toBe(false);
  });

  it('rejects names not starting with a letter', () => {
    expect(validateCommandName('1build')).toBe(false);
    expect(validateCommandName('-build')).toBe(false);
  });

  it('rejects spaces, underscores and special characters', () => {
    expect(validateCommandName('build all')).toBe(false);
    expect(validateCommandName('build_all')).toBe(false);
    expect(validateCommandName('build!')).toBe(false);
    expect(validateCommandName('')).toBe(false);
  });
});

describe('normalizeCommandName', () => {
  it('lowercases the name', () => {
    expect(normalizeCommandName('BUILD')).toBe('build');
    expect(normalizeCommandName('BuildAll')).toBe('buildall');
  });

  it('replaces non-alphanumeric/hyphen chars with hyphens', () => {
    expect(normalizeCommandName('Build All')).toBe('build-all');
    expect(normalizeCommandName('build_all')).toBe('build-all');
    expect(normalizeCommandName('foo!!!bar')).toBe('foo-bar');
  });

  it('collapses consecutive separators into a single hyphen', () => {
    expect(normalizeCommandName('a   b')).toBe('a-b');
    expect(normalizeCommandName('a__b')).toBe('a-b');
  });

  it('passes already-normalized names through unchanged', () => {
    expect(normalizeCommandName('foo-bar')).toBe('foo-bar');
    expect(normalizeCommandName('build')).toBe('build');
  });
});

describe('createPluginCommandRegistry / constructor', () => {
  it('returns a PluginCommandRegistry instance with wired managers', () => {
    const registry = createPluginCommandRegistry(new Command());
    expect(registry).toBeInstanceOf(PluginCommandRegistry);
    expect(registry.getMiddlewareManager()).toBeDefined();
    expect(registry.getConflictResolver()).toBeDefined();
  });

  it('merges a partial config override (allowConflicts) into the defaults', async () => {
    const registry = createPluginCommandRegistry(new Command(), { allowConflicts: true });
    await registry.initialize();
    // With allowConflicts enabled, registering a duplicate name succeeds.
    const first = await registry.registerCommand(makePlugin('a'), makeDefinition({ name: 'dup' }));
    const second = await registry.registerCommand(makePlugin('b'), makeDefinition({ name: 'dup' }));
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
  });
});

describe('initialize', () => {
  it('emits registry-initializing then registry-initialized', async () => {
    const registry = new PluginCommandRegistry(new Command());
    const events: string[] = [];
    registry.on('registry-initializing', () => events.push('initializing'));
    registry.on('registry-initialized', () => events.push('initialized'));
    await registry.initialize();
    expect(events).toEqual(['initializing', 'initialized']);
  });

  it('is idempotent — a second call does not re-emit', async () => {
    const registry = new PluginCommandRegistry(new Command());
    let count = 0;
    registry.on('registry-initialized', () => count++);
    await registry.initialize();
    await registry.initialize();
    expect(count).toBe(1);
  });

  it('rejects registerCommand until initialized', async () => {
    const registry = new PluginCommandRegistry(new Command());
    await expect(registry.registerCommand(makePlugin(), makeDefinition())).rejects.toThrow(ValidationError);
    await expect(registry.registerCommand(makePlugin(), makeDefinition())).rejects.toThrow(/not initialized/);
  });
});

describe('registerCommand — success path', () => {
  it('registers a valid command and returns a success result', async () => {
    const registry = await makeReadyRegistry();
    const result = await registry.registerCommand(makePlugin(), makeDefinition());
    expect(result.success).toBe(true);
    expect(result.commandId).toBe('test-plugin:build');
    expect(result.conflicts).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('stores the command and exposes it via getCommand/getCommands', async () => {
    const registry = await makeReadyRegistry();
    const result = await registry.registerCommand(makePlugin(), makeDefinition());
    const cmd = registry.getCommand(result.commandId);
    expect(cmd).toBeDefined();
    expect(cmd?.definition.name).toBe('build');
    expect(cmd?.pluginName).toBe('test-plugin');
    expect(cmd?.usageCount).toBe(0);
    expect(cmd?.isActive).toBe(true);
    expect(registry.getCommands()).toHaveLength(1);
  });

  it('emits command-registered with the command id and plugin name', async () => {
    const registry = await makeReadyRegistry();
    const emitted: { commandId?: string; pluginName?: string } = {};
    registry.on('command-registered', (payload) => {
      emitted.commandId = payload.commandId;
      emitted.pluginName = payload.pluginName;
    });
    await registry.registerCommand(makePlugin(), makeDefinition());
    expect(emitted.commandId).toBe('test-plugin:build');
    expect(emitted.pluginName).toBe('test-plugin');
  });

  it('registers aliases that are resolvable via findCommand', async () => {
    const registry = await makeReadyRegistry();
    const result = await registry.registerCommand(
      makePlugin(),
      makeDefinition({ aliases: ['b', 'make'] })
    );
    expect(registry.findCommand('build')?.id).toBe(result.commandId);
    expect(registry.findCommand('b')?.id).toBe(result.commandId);
    expect(registry.findCommand('make')?.id).toBe(result.commandId);
    expect(registry.findCommand('nope')).toBeUndefined();
  });

  it('groups commands by plugin via getPluginCommands', async () => {
    const registry = await makeReadyRegistry();
    await registry.registerCommand(makePlugin('alpha'), makeDefinition({ name: 'a' }));
    await registry.registerCommand(makePlugin('alpha'), makeDefinition({ name: 'b' }));
    await registry.registerCommand(makePlugin('beta'), makeDefinition({ name: 'c' }));
    expect(registry.getPluginCommands('alpha')).toHaveLength(2);
    expect(registry.getPluginCommands('beta')).toHaveLength(1);
    expect(registry.getPluginCommands('gamma')).toHaveLength(0);
  });
});

describe('registerCommand — validation failures', () => {
  it('fails when the name is missing/empty', async () => {
    const registry = await makeReadyRegistry();
    const result = await registry.registerCommand(makePlugin(), makeDefinition({ name: '' }));
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/name is required/i);
  });

  it('fails when the description is missing', async () => {
    const registry = await makeReadyRegistry();
    const result = await registry.registerCommand(makePlugin(), makeDefinition({ description: '' }));
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/description is required/i);
  });

  it('fails for names with spaces or uppercase letters', async () => {
    const registry = await makeReadyRegistry();
    const withSpace = await registry.registerCommand(makePlugin(), makeDefinition({ name: 'Build All' }));
    expect(withSpace.success).toBe(false);
    expect(withSpace.errors[0]).toMatch(/cannot contain spaces/i);
    const upper = await registry.registerCommand(makePlugin(), makeDefinition({ name: 'UPPER' }));
    expect(upper.success).toBe(false);
    expect(upper.errors[0]).toMatch(/must be lowercase/i);
  });

  it('fails when the handler is not a function', async () => {
    const registry = await makeReadyRegistry();
    const result = await registry.registerCommand(
      makePlugin(),
      makeDefinition({ handler: 'nope' as unknown as PluginCommandDefinition['handler'] })
    );
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/handler must be a function/i);
  });

  it('fails when an option flag does not start with -', async () => {
    const registry = await makeReadyRegistry();
    const result = await registry.registerCommand(
      makePlugin(),
      makeDefinition({ options: [{ flag: 'verbose', description: 'verbose' }] })
    );
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/flag must start with/i);
  });

  it('emits command-registration-failed on a validation failure', async () => {
    const registry = await makeReadyRegistry();
    let emitted = false;
    registry.on('command-registration-failed', () => { emitted = true; });
    await registry.registerCommand(makePlugin(), makeDefinition({ name: '' }));
    expect(emitted).toBe(true);
  });
});

describe('unregisterCommand / unregisterPluginCommands', () => {
  it('removes a registered command and clears its aliases', async () => {
    const registry = await makeReadyRegistry();
    const result = await registry.registerCommand(makePlugin(), makeDefinition({ aliases: ['b'] }));
    expect(await registry.unregisterCommand(result.commandId)).toBe(true);
    expect(registry.getCommand(result.commandId)).toBeUndefined();
    expect(registry.findCommand('b')).toBeUndefined();
    expect(registry.getCommands()).toHaveLength(0);
  });

  it('returns false for an unknown command id', async () => {
    const registry = await makeReadyRegistry();
    expect(await registry.unregisterCommand('nope:nope')).toBe(false);
  });

  it('unregisterPluginCommands removes all of a plugin commands and returns the count', async () => {
    const registry = await makeReadyRegistry();
    await registry.registerCommand(makePlugin('alpha'), makeDefinition({ name: 'a' }));
    await registry.registerCommand(makePlugin('alpha'), makeDefinition({ name: 'b' }));
    await registry.registerCommand(makePlugin('beta'), makeDefinition({ name: 'c' }));
    const removed = await registry.unregisterPluginCommands('alpha');
    expect(removed).toBe(2);
    expect(registry.getPluginCommands('alpha')).toHaveLength(0);
    expect(registry.getPluginCommands('beta')).toHaveLength(1);
  });
});

describe('conflict tracking and resolution', () => {
  it('records conflicts and warnings when a duplicate name registers (allowConflicts)', async () => {
    const registry = await makeReadyRegistry({ allowConflicts: true });
    await registry.registerCommand(makePlugin('alpha'), makeDefinition({ name: 'build' }));
    const second = await registry.registerCommand(makePlugin('beta'), makeDefinition({ name: 'build' }));
    expect(second.success).toBe(true);
    expect(second.conflicts).toContain('alpha:build');
    expect(second.warnings.length).toBeGreaterThan(0);
    expect(registry.getConflicts().get('build')).toEqual(['beta:build']);
  });

  it('resolveConflicts(disable) deactivates all but the first conflicting command', async () => {
    const registry = await makeReadyRegistry({ allowConflicts: true });
    await registry.registerCommand(makePlugin('alpha'), makeDefinition({ name: 'build' }));
    await registry.registerCommand(makePlugin('beta'), makeDefinition({ name: 'build' }));
    await registry.registerCommand(makePlugin('gamma'), makeDefinition({ name: 'build' }));
    const resolved = await registry.resolveConflicts('build', 'disable');
    expect(resolved).toBe(true);
    expect(registry.getCommand('beta:build')?.isActive).toBe(true);
    expect(registry.getCommand('gamma:build')?.isActive).toBe(false);
  });

  it('resolveConflicts(priority) keeps the highest-priority command active', async () => {
    const registry = await makeReadyRegistry({ allowConflicts: true });
    await registry.registerCommand(makePlugin('alpha'), makeDefinition({ name: 'build', priority: 1 }));
    await registry.registerCommand(makePlugin('beta'), makeDefinition({ name: 'build', priority: 10 }));
    await registry.registerCommand(makePlugin('gamma'), makeDefinition({ name: 'build', priority: 5 }));
    const resolved = await registry.resolveConflicts('build', 'priority');
    expect(resolved).toBe(true);
    expect(registry.getCommand('beta:build')?.isActive).toBe(true);
    expect(registry.getCommand('gamma:build')?.isActive).toBe(false);
  });

  it('resolveConflicts returns false when there are no conflicts for the name', async () => {
    const registry = await makeReadyRegistry();
    expect(await registry.resolveConflicts('nope', 'disable')).toBe(false);
  });
});

describe('getStats', () => {
  it('reports empty stats for a fresh registry', async () => {
    const registry = await makeReadyRegistry();
    const stats = registry.getStats();
    expect(stats.totalCommands).toBe(0);
    expect(stats.activeCommands).toBe(0);
    expect(stats.totalAliases).toBe(0);
    expect(stats.totalConflicts).toBe(0);
    expect(stats.commandsByPlugin).toEqual({});
    expect(stats.mostUsedCommands).toEqual([]);
    expect(stats.recentCommands).toEqual([]);
  });

  it('aggregates totals, active counts, aliases and per-plugin breakdown', async () => {
    const registry = await makeReadyRegistry({ allowConflicts: true });
    await registry.registerCommand(makePlugin('alpha'), makeDefinition({ name: 'a', aliases: ['x'] }));
    await registry.registerCommand(makePlugin('alpha'), makeDefinition({ name: 'b' }));
    await registry.registerCommand(makePlugin('beta'), makeDefinition({ name: 'c' }));
    const stats = registry.getStats();
    expect(stats.totalCommands).toBe(3);
    expect(stats.activeCommands).toBe(3);
    expect(stats.totalAliases).toBe(1);
    expect(stats.commandsByPlugin).toEqual({ alpha: 2, beta: 1 });
  });
});

describe('accessors', () => {
  it('exposes the middleware manager and conflict resolver', async () => {
    const registry = await makeReadyRegistry();
    expect(registry.getMiddlewareManager()).toBeDefined();
    expect(registry.getConflictResolver()).toBeDefined();
  });

  it('updateConflictResolver refreshes resolver state without throwing', async () => {
    const registry = await makeReadyRegistry();
    await registry.registerCommand(makePlugin(), makeDefinition());
    expect(() => registry.updateConflictResolver()).not.toThrow();
  });
});
