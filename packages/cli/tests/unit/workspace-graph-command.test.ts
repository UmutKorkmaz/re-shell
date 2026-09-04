import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fsReal from 'fs';
import { manageWorkspaceGraph } from '../../src/commands/workspace-graph';
import { ValidationError } from '../../src/utils/error-handler';
import * as workspaceGraph from '../../src/utils/workspace-graph';
import { loadWorkspaceDefinition } from '../../src/utils/workspace-schema';
import { jsonSuccess, jsonError } from '../../src/utils/json-output';

// Covers src/commands/workspace-graph.ts — the `workspace-graph` command group
// (778 lines): analyze / cycles / order / critical / visualize / interactive /
// default-summary dispatch. The pure WorkspaceDependencyGraph engine is mocked
// (its 32-test suite lives in workspace-graph.test.ts, PR #132-ish) and the
// workspace-schema loader is stubbed; fs.pathExists reads a REAL temp file so
// the no-definition branches exercise genuine filesystem checks. process.exit
// is no-op'd for the ValidationError path.

const mocks = vi.hoisted(() => ({
  prompts: vi.fn(),
}));

vi.mock('../../src/utils/workspace-graph', () => ({
  createWorkspaceDependencyGraph: vi.fn(),
}));
vi.mock('../../src/utils/workspace-schema', () => ({
  loadWorkspaceDefinition: vi.fn(),
}));
vi.mock('../../src/utils/json-output', () => ({
  jsonSuccess: vi.fn(),
  jsonError: vi.fn(),
  enableJsonMode: vi.fn(() => () => {}),
}));
vi.mock('prompts', () => ({ default: mocks.prompts }));

const GRAPH = vi.mocked(workspaceGraph.createWorkspaceDependencyGraph);
const LOAD = vi.mocked(loadWorkspaceDefinition);

/** A fully-green analysis fixture. */
function healthyAnalysis(): workspaceGraph.GraphAnalysis {
  return {
    nodeCount: 3,
    edgeCount: 2,
    cycles: { hasCycles: false, cycles: [], stronglyConnectedComponents: [] },
    criticalPath: ['shell', 'checkout', 'ui-kit'],
    statistics: { maxDepth: 2, avgDependencies: 0.7, avgDependents: 0.7 },
    orphanedNodes: [],
    levels: [],
    topologicalOrder: ['ui-kit', 'checkout', 'shell'],
  } as unknown as workspaceGraph.GraphAnalysis;
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
let tmpDir: string;
let defPath: string;

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

  tmpDir = fsReal.mkdtempSync(path.join(os.tmpdir(), 'ws-graph-cmd-'));
  defPath = path.join(tmpDir, 're-shell.workspaces.yaml');
  fsReal.writeFileSync(defPath, 'workspaces: []\n');

  LOAD.mockResolvedValue({ workspaces: [] } as never);

  GRAPH.mockReturnValue({
    analyzeGraph: vi.fn().mockReturnValue(healthyAnalysis()),
    detectCycles: vi.fn().mockReturnValue({ hasCycles: false, cycles: [] }),
    generateBuildOrder: vi.fn().mockReturnValue({
      order: [['ui-kit'], ['checkout'], ['shell']],
      dependencies: new Map([['checkout', ['ui-kit']]]),
      parallelizable: true,
      maxParallelism: 1,
      estimatedTime: 180,
    }),
    findCriticalPath: vi.fn().mockReturnValue(['shell', 'checkout', 'ui-kit']),
    getVisualizationData: vi.fn().mockReturnValue({
      nodes: [
        { id: 'shell', label: 'shell', group: 'shell', level: 0 },
        { id: 'checkout', label: 'checkout', group: 'app', level: 1 },
        { id: 'ui-kit', label: 'ui-kit', group: 'package', level: 2 },
      ],
      edges: [
        { from: 'checkout', to: 'ui-kit', label: 'package', color: 'blue' },
        { from: 'shell', to: 'checkout', label: 'app', color: 'green' },
      ],
    }),
  } as never);
});

afterEach(() => {
  fsReal.rmSync(tmpDir, { recursive: true, force: true });
});

/** All logged console output joined. */
function logged(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

describe('workspace-graph — command', () => {
  describe('no-definition guards (per subcommand)', () => {
    for (const flag of ['analyze', 'cycles', 'order', 'critical', 'visualize'] as const) {
      it(`${flag}: human mode warns when the definition file is missing`, async () => {
        fsReal.rmSync(defPath);
        await manageWorkspaceGraph({ [flag]: true, file: defPath });
        expect(logged()).toContain('No workspace definition found');
        expect(GRAPH).not.toHaveBeenCalled();
      });

      it(`${flag}: json mode emits WORKSPACE_NOT_FOUND`, async () => {
        fsReal.rmSync(defPath);
        await manageWorkspaceGraph({ [flag]: true, json: true, file: defPath });
        expect(jsonError).toHaveBeenCalledWith(
          'WORKSPACE_NOT_FOUND',
          expect.stringContaining('re-shell.workspaces.yaml')
        );
      });
    }

    it('default summary: human mode warns when the definition file is missing', async () => {
      fsReal.rmSync(defPath);
      await manageWorkspaceGraph({ file: defPath });
      expect(logged()).toContain('No workspace definition found');
      expect(GRAPH).not.toHaveBeenCalled();
    });

    it('default summary: json mode emits WORKSPACE_NOT_FOUND', async () => {
      fsReal.rmSync(defPath);
      await manageWorkspaceGraph({ json: true, file: defPath });
      expect(jsonError).toHaveBeenCalledWith(
        'WORKSPACE_NOT_FOUND',
        expect.stringContaining('re-shell.workspaces.yaml')
      );
    });
  });

  describe('analyze', () => {
    it('renders the human analysis with statistics and critical path', async () => {
      await manageWorkspaceGraph({ analyze: true, file: defPath });
      expect(GRAPH).toHaveBeenCalledTimes(1);
      expect(logged()).toContain('Workspace Dependency Graph Analysis');
      expect(logged()).toContain('Nodes (Workspaces): 3');
      expect(logged()).toContain('Edges (Dependencies): 2');
      expect(logged()).toContain('🎯 Critical Path (3 workspaces)');
    });

    it('emits the analysis payload in json mode with cycle warnings', async () => {
      await manageWorkspaceGraph({ analyze: true, json: true, file: defPath });
      expect(jsonSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ nodeCount: 3, edgeCount: 2 }),
        []
      );
    });

    it('surfaces cycle count as a json warning when cycles exist', async () => {
      const analysis = healthyAnalysis();
      analysis.cycles = {
        hasCycles: true,
        cycles: [{ nodes: ['a', 'b'], length: 2 }] as never,
      };
      const cycleAnalysis = healthyAnalysis();
      cycleAnalysis.cycles = {
        hasCycles: true,
        cycles: [{ nodes: ['a', 'b'], length: 2 }] as never,
      };
      GRAPH.mockReturnValueOnce({
        ...graphStub(),
        analyzeGraph: vi.fn().mockReturnValue(cycleAnalysis),
      });
      await manageWorkspaceGraph({ analyze: true, json: true, file: defPath });
      expect(jsonSuccess).toHaveBeenCalledWith(
        expect.anything(),
        ['1 dependency cycles detected']
      );
    });

    it('logs the loader failure and exits 1 when the loader rejects', async () => {
      LOAD.mockRejectedValueOnce(new Error('bad yaml'));
      await manageWorkspaceGraph({ analyze: true, file: defPath });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('bad yaml'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('cycles', () => {
    it('renders the no-cycles status in human mode', async () => {
      await manageWorkspaceGraph({ cycles: true, file: defPath });
      expect(logged()).toContain('No dependency cycles detected');
    });

    it('emits the cycle payload in json mode', async () => {
      await manageWorkspaceGraph({ cycles: true, json: true, file: defPath });
      expect(jsonSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ hasCycles: false }),
        []
      );
    });
  });

  describe('order', () => {
    it('renders the build order levels in human mode', async () => {
      await manageWorkspaceGraph({ order: true, file: defPath });
      expect(logged()).toContain('Build Order');
      expect(logged()).toContain('Level 1: 1 workspace(s)');
      expect(logged()).toContain('• ui-kit');
    });

    it('emits the build order with dependencies converted from a Map in json mode', async () => {
      await manageWorkspaceGraph({ order: true, json: true, file: defPath });
      const payload = vi.mocked(jsonSuccess).mock.calls[0][0] as {
        order: string[][];
        dependencies: Record<string, string[]>;
      };
      expect(payload.order).toEqual([['ui-kit'], ['checkout'], ['shell']]);
      expect(payload.dependencies).toEqual({ checkout: ['ui-kit'] });
    });
  });

  describe('critical', () => {
    it('renders the critical path in human mode', async () => {
      await manageWorkspaceGraph({ critical: true, file: defPath });
      expect(logged()).toContain('Critical Path');
      expect(logged()).toContain('shell → checkout → ui-kit');
    });

    it('emits { criticalPath } in json mode', async () => {
      await manageWorkspaceGraph({ critical: true, json: true, file: defPath });
      expect(jsonSuccess).toHaveBeenCalledWith(
        { criticalPath: ['shell', 'checkout', 'ui-kit'] },
        []
      );
    });
  });

  describe('visualize', () => {
    it('renders the grouped text visualization in human mode', async () => {
      await manageWorkspaceGraph({ visualize: true, file: defPath });
      expect(logged()).toContain('Workspace Graph Visualization');
      expect(logged()).toContain('shell (1):');
      expect(logged()).toContain('checkout → ui-kit');
    });

    it('emits the visualization payload in json mode', async () => {
      await manageWorkspaceGraph({ visualize: true, json: true, file: defPath });
      const payload = vi.mocked(jsonSuccess).mock.calls[0][0] as {
        nodes: unknown[];
        edges: unknown[];
      };
      expect(payload.nodes).toHaveLength(3);
      expect(payload.edges).toHaveLength(2);
    });

    it('writes the visualization JSON to --output and confirms', async () => {
      const out = path.join(tmpDir, 'graph.json');
      await manageWorkspaceGraph({ visualize: true, file: defPath, output: out });
      expect(fsReal.existsSync(out)).toBe(true);
      expect(logged()).toContain('Visualization data saved to');
      const written = JSON.parse(fsReal.readFileSync(out, 'utf8'));
      expect(written.nodes).toHaveLength(3);
    });
  });

  describe('default summary', () => {
    it('renders counts, cycle status, metrics and available commands', async () => {
      await manageWorkspaceGraph({ file: defPath });
      expect(logged()).toContain('Workspace Dependency Graph Summary');
      expect(logged()).toContain('Workspaces: 3');
      expect(logged()).toContain('Dependencies: 2');
      expect(logged()).toContain('No cycles');
      expect(logged()).toContain('re-shell workspace-graph analyze');
    });

    it('emits the compact summary envelope in json mode', async () => {
      await manageWorkspaceGraph({ json: true, file: defPath });
      expect(jsonSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaces: 3,
          dependencies: 2,
          hasCycles: false,
          cycleCount: 0,
          maxDepth: 2,
          orphaned: 0,
        }),
        []
      );
    });

    it('renders orphaned nodes section when present', async () => {
      const analysis = healthyAnalysis();
      analysis.orphanedNodes = ['legacy'] as never;
      GRAPH.mockReturnValueOnce({
        ...graphStub(),
        analyzeGraph: vi.fn().mockReturnValue(analysis),
      });
      await manageWorkspaceGraph({ file: defPath });
      expect(logged()).toContain('Orphaned: 1');
    });
  });

  describe('interactive', () => {
    it('prompts and dispatches to the chosen action', async () => {
      mocks.prompts.mockResolvedValueOnce({ action: 'summary' });
      await manageWorkspaceGraph({ interactive: true, file: defPath });
      expect(logged()).toContain('Workspace Dependency Graph Summary');
    });

    it('does nothing when the prompt is cancelled', async () => {
      mocks.prompts.mockResolvedValueOnce({});
      await manageWorkspaceGraph({ interactive: true, file: defPath });
      expect(GRAPH).not.toHaveBeenCalled();
    });

    it('warns when no definition exists (human path)', async () => {
      fsReal.rmSync(defPath);
      await manageWorkspaceGraph({ interactive: true, file: defPath });
      expect(logged()).toContain('No workspace definition found');
      expect(GRAPH).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('renders the missing-definition hint and exits 1 on ValidationError', async () => {
      LOAD.mockRejectedValueOnce(
        new ValidationError('missing')
      );
      await manageWorkspaceGraph({ file: defPath });
      expect(logged()).toContain("Run 're-shell workspace-def init'");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('renders the generic error and exits 1 on other failures', async () => {
      LOAD.mockRejectedValueOnce(new Error('boom'));
      await manageWorkspaceGraph({ file: defPath });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});

/** The mock graph object returned by the factory (single instance per test). */
function graphMock(): { analyzeGraph: ReturnType<typeof vi.fn> } {
  return GRAPH.mock.results[0]?.value as {
    analyzeGraph: ReturnType<typeof vi.fn>;
  };
}

/** A fresh graph stub matching the beforeEach default. */
function graphStub() {
  return {
    analyzeGraph: vi.fn().mockReturnValue(healthyAnalysis()),
    detectCycles: vi.fn().mockReturnValue({ hasCycles: false, cycles: [] }),
    generateBuildOrder: vi.fn().mockReturnValue({
      order: [['ui-kit'], ['checkout'], ['shell']],
      dependencies: new Map([['checkout', ['ui-kit']]]),
      parallelizable: true,
      maxParallelism: 1,
      estimatedTime: 180,
    }),
    findCriticalPath: vi.fn().mockReturnValue(['shell', 'checkout', 'ui-kit']),
    getVisualizationData: vi.fn().mockReturnValue({
      nodes: [
        { id: 'shell', label: 'shell', group: 'shell', level: 0 },
        { id: 'checkout', label: 'checkout', group: 'app', level: 1 },
        { id: 'ui-kit', label: 'ui-kit', group: 'package', level: 2 },
      ],
      edges: [
        { from: 'checkout', to: 'ui-kit', label: 'package', color: 'blue' },
        { from: 'shell', to: 'checkout', label: 'app', color: 'green' },
      ],
    }),
  };
}
