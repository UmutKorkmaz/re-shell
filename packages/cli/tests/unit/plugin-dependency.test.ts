import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  ResolutionResult,
  DependencyConflict,
  DependencyNode,
} from '../../src/utils/plugin-dependency';

// Covers src/commands/plugin-dependency.ts — the `plugin dependency`
// subcommands: resolve, tree, conflicts, validate, update. The plugin
// registry and the dependency resolver engine are mocked with scripted
// fixtures; semver validation runs for real (it is the code under test).

vi.mock('../../src/utils/plugin-system', () => ({
  createPluginRegistry: vi.fn(),
}));
vi.mock('../../src/utils/plugin-dependency', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/utils/plugin-dependency')>();
  return {
    ...actual,
    createDependencyResolver: vi.fn(),
  };
});
// Spinner messages (succeed/fail) land on the spinner instance, not
// console.log — record them so tests can assert on them.
const spinnerMessages: string[] = [];
vi.mock('../../src/utils/spinner', () => ({
  createSpinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    succeed: (msg?: string) => spinnerMessages.push(msg ?? ''),
    fail: (msg?: string) => spinnerMessages.push(msg ?? ''),
    setText: vi.fn(),
    text: '',
  }),
}));

const { createPluginRegistry } = await import('../../src/utils/plugin-system');
const { createDependencyResolver } = await import('../../src/utils/plugin-dependency');
const {
  resolveDependencies,
  showDependencyTree,
  checkConflicts,
  validateVersions,
  updateDependencies,
} = await import('../../src/commands/plugin-dependency');

type PluginFixture = {
  manifest: {
    name: string;
    version: string;
    dependencies?: Record<string, string>;
    reshell?: { plugins?: Record<string, string> };
  };
};

type ResolverFixture = {
  registerPlugin: ReturnType<typeof vi.fn>;
  resolveDependencies: ReturnType<typeof vi.fn>;
  getDependencyGraph: ReturnType<typeof vi.fn>;
};

let registryFixture: {
  initialize: ReturnType<typeof vi.fn>;
  getPlugins: ReturnType<typeof vi.fn>;
  getPlugin: ReturnType<typeof vi.fn>;
};
let resolverFixture: ResolverFixture;

function plugin(name: string, version: string, extra: Partial<PluginFixture['manifest']> = {}): PluginFixture {
  return { manifest: { name, version, ...extra } };
}

function node(
  name: string,
  version: string,
  dependencies: string[],
  dependents: string[] = [],
  resolved = true,
  depth = 0
): DependencyNode {
  return {
    name,
    version,
    dependencies: new Set(dependencies),
    dependents: new Set(dependents),
    resolved,
    depth,
  };
}

function resolutionResult(overrides: Partial<ResolutionResult> = {}): ResolutionResult {
  return {
    resolved: [],
    conflicts: [],
    missing: [],
    circular: [],
    installationPlan: [],
    success: true,
    warnings: [],
    ...overrides,
  };
}

function conflict(overrides: Partial<DependencyConflict> = {}): DependencyConflict {
  return {
    type: 'incompatible',
    source: 'plugin-a',
    target: 'plugin-b',
    requested: '^1.0.0',
    resolution: {
      action: 'upgrade',
      target: 'plugin-b',
      version: '^2.0.0',
      reason: 'plugin-a requires ^2.0.0',
    },
    ...overrides,
  } as DependencyConflict;
}

let logs: string[];

function output(): string {
  return logs.join('\n');
}

/** JSON emitted via console.log: parse the LAST logged line. */
function jsonOutput<T>(): T {
  return JSON.parse(logs[logs.length - 1]) as T;
}

beforeEach(() => {
  vi.clearAllMocks();
  spinnerMessages.length = 0;
  logs = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.join(' '));
  });

  registryFixture = {
    initialize: vi.fn().mockResolvedValue(undefined),
    getPlugins: vi.fn().mockReturnValue([]),
    getPlugin: vi.fn().mockReturnValue(undefined),
  };
  vi.mocked(createPluginRegistry).mockReturnValue(registryFixture as never);

  resolverFixture = {
    registerPlugin: vi.fn(),
    resolveDependencies: vi.fn().mockResolvedValue(resolutionResult()),
    getDependencyGraph: vi.fn().mockReturnValue(new Map<string, DependencyNode>()),
  };
  vi.mocked(createDependencyResolver).mockReturnValue(resolverFixture as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('plugin-dependency — commands', () => {
  describe('resolveDependencies', () => {
    it('rejects when the plugin is not registered', async () => {
      registryFixture.getPlugin.mockReturnValue(undefined);
      await expect(resolveDependencies('ghost')).rejects.toThrow(
        "Dependency resolution failed: Plugin 'ghost' not found"
      );
    });

    it('registers every discovered plugin with the resolver and resolves the manifest', async () => {
      const plugins = [plugin('alpha', '1.0.0'), plugin('beta', '2.0.0')];
      registryFixture.getPlugin.mockReturnValue(plugins[0]);
      registryFixture.getPlugins.mockReturnValue(plugins);

      await resolveDependencies('alpha');

      expect(resolverFixture.registerPlugin).toHaveBeenCalledTimes(2);
      expect(resolverFixture.resolveDependencies).toHaveBeenCalledWith(plugins[0].manifest, {
        strategy: 'strict',
        allowPrerelease: false,
        ignoreOptional: false,
        autoInstall: false,
      });
    });

    it('prints the resolution summary with counts in human mode', async () => {
      registryFixture.getPlugin.mockReturnValue(plugin('alpha', '1.0.0'));
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0')]);
      resolverFixture.resolveDependencies.mockResolvedValueOnce(
        resolutionResult({
          resolved: [
            { name: 'beta', version: '^2.0.0', resolvedVersion: '2.1.0', resolved: true } as never,
          ],
          circular: [['alpha', 'beta', 'alpha']],
          warnings: ['optional dependency skipped'],
        })
      );

      await resolveDependencies('alpha');

      expect(output()).toContain('Dependency Resolution for alpha');
      expect(output()).toContain('Success: ✓');
      expect(output()).toContain('Resolved: 1 dependencies');
      expect(output()).toContain('Circular: 1 cycles');
      expect(output()).toContain('beta ^2.0.0 → 2.1.0');
      expect(output()).toContain('optional dependency skipped');
    });

    it('lists missing and conflicting dependencies in the human render', async () => {
      registryFixture.getPlugin.mockReturnValue(plugin('alpha', '1.0.0'));
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0')]);
      resolverFixture.resolveDependencies.mockResolvedValueOnce(
        resolutionResult({
          success: false,
          missing: ['ghost-dep'],
          conflicts: [conflict()],
        })
      );

      await resolveDependencies('alpha');

      expect(output()).toContain('Success: ✗');
      expect(output()).toContain('Missing Dependencies');
      expect(output()).toContain('ghost-dep');
      expect(output()).toContain('Conflicts:');
      expect(output()).toContain('incompatible conflict:');
      expect(output()).toContain('Source: plugin-a');
    });

    it('shows per-dependency conflicts in verbose mode', async () => {
      registryFixture.getPlugin.mockReturnValue(plugin('alpha', '1.0.0'));
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0')]);
      resolverFixture.resolveDependencies.mockResolvedValueOnce(
        resolutionResult({
          resolved: [
            {
              name: 'beta',
              version: '^2.0.0',
              resolvedVersion: '1.0.0',
              resolved: false,
              conflicts: [conflict({ requested: '^2.0.0', available: '1.0.0' })],
            } as never,
          ],
        })
      );

      await resolveDependencies('alpha', { verbose: true });

      expect(output()).toContain('incompatible: ^2.0.0 vs 1.0.0');
    });

    it('emits the raw resolution result as JSON', async () => {
      registryFixture.getPlugin.mockReturnValue(plugin('alpha', '1.0.0'));
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0')]);
      const result = resolutionResult({ success: false, missing: ['ghost'] });
      resolverFixture.resolveDependencies.mockResolvedValueOnce(result);

      await resolveDependencies('alpha', { json: true });

      expect(jsonOutput()).toEqual(result);
    });

    it('renders the dry-run installation plan when autoInstall is requested', async () => {
      registryFixture.getPlugin.mockReturnValue(plugin('alpha', '1.0.0'));
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0')]);
      resolverFixture.resolveDependencies.mockResolvedValueOnce(
        resolutionResult({
          installationPlan: [
            {
              order: 0,
              action: 'install',
              plugin: 'beta',
              version: '2.1.0',
              optional: false,
              dependencies: ['gamma'],
            } as never,
            {
              order: 1,
              action: 'upgrade',
              plugin: 'gamma',
              version: '3.0.0',
              optional: true,
              dependencies: [],
            } as never,
          ],
        })
      );

      await resolveDependencies('alpha', { dryRun: true, autoInstall: true });

      expect(output()).toContain('Installation Plan (Dry Run)');
      expect(output()).toContain('1. install beta v2.1.0');
      expect(output()).toContain('Dependencies: gamma');
      expect(output()).toContain('2. upgrade gamma v3.0.0');
      expect(output()).toContain('(optional)');
      // autoInstall is suppressed for the resolver itself in dry-run mode.
      expect(resolverFixture.resolveDependencies).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ autoInstall: false })
      );
    });

    it('wraps resolver failures in a ValidationError', async () => {
      registryFixture.getPlugin.mockReturnValue(plugin('alpha', '1.0.0'));
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0')]);
      resolverFixture.resolveDependencies.mockRejectedValueOnce(new Error('graph exploded'));

      await expect(resolveDependencies('alpha')).rejects.toThrow(
        'Dependency resolution failed: graph exploded'
      );
    });
  });

  describe('showDependencyTree', () => {
    it('renders the full tree from top-level plugins when no name is given', async () => {
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0')]);
      resolverFixture.getDependencyGraph.mockReturnValueOnce(
        new Map([
          ['alpha', node('alpha', '1.0.0', ['beta'])],
          ['beta', node('beta', '2.0.0', [], ['alpha'], true, 1)],
        ])
      );

      await showDependencyTree();

      expect(output()).toContain('Plugin Dependency Tree');
      // alpha is top-level (has a dependent? no — dependents empty) → rendered first.
      expect(output()).toContain('alpha v1.0.0');
      expect(output()).toContain('beta v2.0.0');
    });

    it('notes an empty graph explicitly', async () => {
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0')]);
      resolverFixture.getDependencyGraph.mockReturnValueOnce(new Map());

      await showDependencyTree();
      expect(output()).toContain('No plugins found in dependency graph.');
    });

    it('renders a single plugin subtree for a given name', async () => {
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0')]);
      resolverFixture.getDependencyGraph.mockReturnValueOnce(
        new Map([
          ['alpha', node('alpha', '1.0.0', ['beta'])],
          ['beta', node('beta', '2.0.0', [], ['alpha'], true, 1)],
        ])
      );

      await showDependencyTree('alpha');
      expect(output()).toContain('alpha v1.0.0');
      expect(output()).toContain('beta v2.0.0');
    });

    it('rejects for a name absent from the graph', async () => {
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0')]);
      resolverFixture.getDependencyGraph.mockReturnValueOnce(new Map());

      await expect(showDependencyTree('ghost')).rejects.toThrow(
        "Failed to show dependency tree: Plugin 'ghost' not found in dependency graph"
      );
    });

    it('marks unresolved and missing nodes distinctly', async () => {
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0')]);
      resolverFixture.getDependencyGraph.mockReturnValueOnce(
        new Map([
          ['alpha', node('alpha', '1.0.0', ['beta', 'ghost'], [], false)],
        ])
      );

      await showDependencyTree('alpha');
      expect(output()).toContain('ghost (missing)');
      expect(resolverFixture.getDependencyGraph).toHaveBeenCalledTimes(1);
    });

    it('annotates circular references instead of recursing forever', async () => {
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0')]);
      resolverFixture.getDependencyGraph.mockReturnValueOnce(
        new Map([
          ['alpha', node('alpha', '1.0.0', ['beta'])],
          ['beta', node('beta', '2.0.0', ['alpha'], ['alpha'])],
        ])
      );

      await showDependencyTree('alpha');
      expect(output()).toContain('alpha v1.0.0');
      expect(output()).toContain('beta v2.0.0');
    });

    it('emits the graph as a plain array of nodes in JSON mode', async () => {
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0')]);
      resolverFixture.getDependencyGraph.mockReturnValueOnce(
        new Map([
          ['alpha', node('alpha', '1.0.0', ['beta'])],
          ['beta', node('beta', '2.0.0', [], ['alpha'], true, 1)],
        ])
      );

      await showDependencyTree(undefined, { json: true });
      const graph = jsonOutput<
        Array<{ name: string; dependencies: string[]; dependents: string[] }>
      >();
      expect(graph).toHaveLength(2);
      expect(graph[0]).toMatchObject({ name: 'alpha', dependencies: ['beta'], dependents: [] });
      expect(graph[1]).toMatchObject({ name: 'beta', dependencies: [], dependents: ['alpha'] });
    });
  });

  describe('checkConflicts', () => {
    it('reports success when every plugin resolves without conflicts', async () => {
      const plugins = [plugin('alpha', '1.0.0'), plugin('beta', '2.0.0')];
      registryFixture.getPlugins.mockReturnValue(plugins);
      resolverFixture.resolveDependencies.mockResolvedValue(resolutionResult());

      await checkConflicts();

      expect(resolverFixture.resolveDependencies).toHaveBeenCalledTimes(2);
      expect(output()).toContain('No dependency conflicts found');
      expect(output()).toContain('Analyzed 2 plugins successfully');
    });

    it('lists conflicts and suggested resolutions across plugins', async () => {
      const plugins = [plugin('alpha', '1.0.0')];
      registryFixture.getPlugins.mockReturnValue(plugins);
      resolverFixture.resolveDependencies.mockResolvedValueOnce(
        resolutionResult({ success: false, conflicts: [conflict()] })
      );

      await checkConflicts({ verbose: true });

      expect(output()).toContain('Found 1 dependency conflicts');
      expect(output()).toContain('Suggested Resolutions');
      expect(output()).toContain('1. upgrade plugin-b');
      expect(output()).toContain('Version: ^2.0.0');
      expect(output()).toContain('Reason: plugin-a requires ^2.0.0');
    });

    it('converts unresolvable plugins into remove-action conflicts', async () => {
      const plugins = [plugin('alpha', '1.0.0')];
      registryFixture.getPlugins.mockReturnValue(plugins);
      resolverFixture.resolveDependencies.mockRejectedValueOnce(new Error('circular doom'));

      await checkConflicts();

      expect(output()).toContain('Found 1 dependency conflicts');
      expect(output()).toContain('Suggested Resolutions');
      expect(output()).toContain('1. remove alpha');
      expect(output()).toContain('Reason: circular doom');
    });

    it('emits conflicts plus summary counts in JSON mode', async () => {
      const plugins = [plugin('alpha', '1.0.0'), plugin('beta', '2.0.0')];
      registryFixture.getPlugins.mockReturnValue(plugins);
      resolverFixture.resolveDependencies
        .mockResolvedValueOnce(resolutionResult({ conflicts: [conflict()] }))
        .mockResolvedValueOnce(resolutionResult());

      await checkConflicts({ json: true });

      const payload = jsonOutput<{
        conflicts: DependencyConflict[];
        totalPlugins: number;
        pluginsWithConflicts: number;
      }>();
      expect(payload.totalPlugins).toBe(2);
      expect(payload.pluginsWithConflicts).toBe(1);
      expect(payload.conflicts).toHaveLength(1);
    });
  });

  describe('validateVersions', () => {
    it('reports every plugin valid with clean semver versions', async () => {
      registryFixture.getPlugins.mockReturnValue([
        plugin('alpha', '1.0.0'),
        plugin('beta', '2.3.4'),
      ]);

      await validateVersions();

      expect(output()).toContain('Valid plugins: 2/2');
      expect(output()).not.toContain('Invalid plugins');
    });

    it('flags invalid plugin version formats', async () => {
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', 'not-semver')]);

      await validateVersions();

      expect(output()).toContain('Valid plugins: 0/1');
      expect(output()).toContain('Invalid plugins: 1');
      expect(output()).toContain('Invalid version format');
    });

    it('flags invalid dependency version ranges', async () => {
      registryFixture.getPlugins.mockReturnValue([
        plugin('alpha', '1.0.0', { dependencies: { beta: 'banana-range' } }),
      ]);

      await validateVersions();

      expect(output()).toContain('Invalid plugins: 1');
      expect(output()).toContain('Invalid dependency version range: beta@banana-range');
    });

    it('notes prerelease versions as issues without invalidating the plugin', async () => {
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0-beta.1')]);

      await validateVersions();

      expect(output()).toContain('Valid plugins: 1/1');
      expect(output()).not.toContain('Invalid plugins');
    });

    it('lists prerelease issues only in verbose mode', async () => {
      registryFixture.getPlugins.mockReturnValue([plugin('alpha', '1.0.0-beta.1')]);

      await validateVersions();
      expect(output()).not.toContain('Prerelease version');

      await validateVersions({ verbose: true });
      expect(output()).toContain('Prerelease version');
    });

    it('flags outdated plugin dependencies against installed versions', async () => {
      registryFixture.getPlugins.mockReturnValue([
        plugin('alpha', '1.0.0', { reshell: { plugins: { beta: '1.0.0' } } }),
        plugin('beta', '2.0.0'),
      ]);
      registryFixture.getPlugin.mockImplementation((name: string) =>
        name === 'beta' ? plugin('beta', '2.0.0') : undefined
      );

      await validateVersions({ verbose: true });

      expect(output()).toContain('Outdated plugin dependency: beta@1.0.0 (latest: 2.0.0)');
    });

    it('emits the validation table as JSON', async () => {
      registryFixture.getPlugins.mockReturnValue([
        plugin('alpha', '1.0.0'),
        plugin('beta', 'bad'),
      ]);

      await validateVersions({ json: true });

      const payload = jsonOutput<
        Array<{ plugin: string; version: string; valid: boolean; issues: string[] }>
      >();
      expect(payload).toHaveLength(2);
      expect(payload[0]).toMatchObject({ plugin: 'alpha', valid: true, issues: [] });
      expect(payload[1]).toMatchObject({ plugin: 'beta', valid: false });
      expect(payload[1].issues).toContain('Invalid version format');
    });
  });

  describe('updateDependencies', () => {
    it('rejects when the plugin is not registered', async () => {
      registryFixture.getPlugin.mockReturnValue(undefined);
      await expect(updateDependencies('ghost')).rejects.toThrow(
        "Dependency update failed: Plugin 'ghost' not found"
      );
    });

    it('succeeds after the simulated update round-trip', async () => {
      registryFixture.getPlugin.mockReturnValue(plugin('alpha', '1.0.0'));
      vi.useFakeTimers();

      const pending = updateDependencies('alpha');
      // The command sleeps 2s to simulate the (TODO) update work.
      await vi.advanceTimersByTimeAsync(2000);
      await pending;

      expect(spinnerMessages.join('\n')).toContain('Dependencies updated for alpha!');
    });

    it('prints the verbose placeholder listing', async () => {
      registryFixture.getPlugin.mockReturnValue(plugin('alpha', '1.0.0'));
      vi.useFakeTimers();

      const pending = updateDependencies('alpha', { verbose: true });
      await vi.advanceTimersByTimeAsync(2000);
      await pending;

      expect(spinnerMessages.join('\n')).toContain('Dependencies updated for alpha!');
      expect(output()).toContain('Updated dependencies would be listed here');
    });
  });
});
