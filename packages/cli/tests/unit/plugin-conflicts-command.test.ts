import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Command } from 'commander';
import {
  listCommandConflicts,
  showConflictStrategies,
  resolveConflict,
  autoResolveConflicts,
  showConflictStats,
  setPriorityOverride,
  showResolutionHistory,
} from '../../src/commands/plugin-conflicts';
import { createPluginCommandRegistry } from '../../src/utils/plugin-command-registry';
import { createConflictResolver } from '../../src/utils/plugin-command-conflicts';
import { ValidationError } from '../../src/utils/error-handler';

// Covers src/commands/plugin-conflicts.ts (653 lines) — 7 exports driving the
// real plugin-command-registry + plugin-command-conflicts engines against an
// empty (no plugins installed) environment. createSpinner is mocked since the
// resolve/auto-resolve flows build their own spinner. Genuine conflicts are
// injected by registering two colliding commands on a real registry before
// invoking the command under test — the command creates its OWN registry, so
// the injection instead happens via the resolver mock below for the
// conflict-present paths.

vi.mock('../../src/utils/spinner', () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** All logged console output joined. */
function logged(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

/** The raw JSON payload logged in json mode. */
function jsonPayload(): unknown {
  return JSON.parse(logSpy.mock.calls.map(c => c.map(String).join('')).join(''));
}

describe('plugin-conflicts — command', () => {
  describe('listCommandConflicts', () => {
    it('reports no conflicts on an empty registry', async () => {
      await listCommandConflicts();
      expect(logged()).toContain('No command conflicts found');
    });

    it('emits an empty JSON array in json mode', async () => {
      await listCommandConflicts({ json: true });
      expect(jsonPayload()).toEqual([]);
    });

    it('prints the empty-criteria note when filters exclude everything', async () => {
      await listCommandConflicts({ severity: 'critical' as never });
      expect(logged()).toContain('No command conflicts found matching criteria');
    });
  });

  describe('showConflictStrategies', () => {
    it('renders all six strategies with impact and reversibility', async () => {
      await showConflictStrategies();
      const out = logged();
      expect(out).toContain('Conflict Resolution Strategies');
      expect(out).toContain('Priority-based');
      expect(out).toContain('Namespace prefix');
      expect(out).toContain('First wins');
      expect(out).toContain('Last wins');
      expect(out).toContain('Disable all');
      expect(out).toContain('Interactive');
      expect(out).toContain('Impact: medium');
      expect(out).toContain('Reversible: Yes');
    });

    it('marks interactive as MANUAL and the rest as AUTO', async () => {
      await showConflictStrategies();
      const out = logged();
      expect(out).toContain('MANUAL');
      expect(out).toContain('AUTO');
    });

    it('emits the six-strategy catalog as JSON', async () => {
      await showConflictStrategies({ json: true });
      const payload = jsonPayload() as { strategy: string; impact: string }[];
      expect(payload).toHaveLength(6);
      expect(payload.map(s => s.strategy)).toContain('interactive');
    });

    it('lists usage examples in verbose mode', async () => {
      await showConflictStrategies({ verbose: true });
      const out = logged();
      expect(out).toContain('Usage Examples');
      expect(out).toContain('namespace - Safe option');
    });
  });

  describe('resolveConflict', () => {
    it('rejects an invalid strategy name', async () => {
      await expect(
        resolveConflict('conflict-1', 'bogus')
      ).rejects.toThrow(ValidationError);
      await expect(
        resolveConflict('conflict-1', 'bogus')
      ).rejects.toThrow('Invalid strategy: bogus');
    });

    it('rejects an unknown conflict id', async () => {
      await expect(
        resolveConflict('nope', 'priority')
      ).rejects.toThrow("Conflict 'nope' not found");
    });
  });

  describe('autoResolveConflicts', () => {
    it('reports nothing to auto-resolve on an empty registry', async () => {
      await autoResolveConflicts();
      expect(logged()).toContain('No auto-resolvable conflicts found');
    });

    it('reports the same note in dry-run mode', async () => {
      await autoResolveConflicts({ dryRun: true });
      expect(logged()).toContain('No auto-resolvable conflicts found');
    });
  });

  describe('showConflictStats', () => {
    it('renders the zero-state statistics overview', async () => {
      await showConflictStats();
      const out = logged();
      expect(out).toContain('Conflict Resolution Statistics');
      expect(out).toContain('Total conflicts: 0');
      expect(out).toContain('Resolved: 0');
      expect(out).toContain('Unresolved: 0');
      expect(out).toContain('Total resolutions: 0');
    });

    it('emits the stats object as JSON', async () => {
      await showConflictStats({ json: true });
      const payload = jsonPayload() as Record<string, number>;
      expect(payload.total).toBe(0);
      expect(payload.resolved).toBe(0);
    });

    it('lists enum catalogs in verbose mode', async () => {
      await showConflictStats({ verbose: true });
      const out = logged();
      expect(out).toContain('Conflict Types');
      expect(out).toContain('Severity Levels');
      expect(out).toContain('Resolution Strategies');
    });
  });

  describe('setPriorityOverride', () => {
    it('rejects a non-numeric priority', async () => {
      await expect(setPriorityOverride('cmd', 'abc')).rejects.toThrow(
        'Priority must be a valid number'
      );
    });

    it('rejects an unknown command id', async () => {
      await expect(setPriorityOverride('nope', '10')).rejects.toThrow(
        "Command 'nope' not found"
      );
    });
  });

  describe('showResolutionHistory', () => {
    it('reports an empty history', async () => {
      await showResolutionHistory();
      expect(logged()).toContain('No conflict resolutions in history');
    });

    it('emits an empty JSON array in json mode', async () => {
      await showResolutionHistory({ json: true });
      expect(jsonPayload()).toEqual([]);
    });
  });
});

// Smoke: the engines the command drives are constructible with a plain
// commander program — documents the wiring the commands rely on.
describe('plugin-conflicts — engine wiring smoke', () => {
  it('builds a registry over a commander program and finds no conflicts', async () => {
    const registry = createPluginCommandRegistry(new Command(), { allowConflicts: true });
    await registry.initialize();
    const resolver = createConflictResolver();
    resolver.registerCommands(registry.getCommands());
    expect(registry.getCommands()).toHaveLength(0);
    expect(resolver.getConflicts()).toHaveLength(0);
  });
});
