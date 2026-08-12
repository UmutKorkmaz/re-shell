import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { manageChangeImpact, analyzeWorkspaceImpact, showDependencyGraph } from '../../src/commands/change-impact';
import { ValidationError } from '../../src/utils/error-handler';

// Covers src/commands/change-impact.ts — the change-impact command group
// (analyze / workspace / graph). We mock createChangeImpactAnalyzer (so the
// ChangeImpactAnalyzer's behavior is controlled) and the ProgressSpinner the
// handlers construct internally, then drive every output branch against a real
// on-disk project dir (for the package.json guard + file outputs).

const mocks = vi.hoisted(() => ({
  createAnalyzer: vi.fn(),
  analyze: vi.fn(),
  getWorkspaceInfo: vi.fn(),
  getDependencyGraph: vi.fn(),
  getImpactVisualization: vi.fn(),
}));

vi.mock('../../src/utils/change-impact-analyzer', () => ({
  createChangeImpactAnalyzer: mocks.createAnalyzer,
  // The class + type are not constructed by the command (only the factory is),
  // so a minimal placeholder satisfies the value import.
  ChangeImpactAnalyzer: class {},
}));
vi.mock('../../src/utils/spinner', () => ({
  ProgressSpinner: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    setText: vi.fn(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
}));

let projectDir: string;
let emptyDir: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let cwdSpy: ReturnType<typeof vi.spyOn>;

function logged(): string {
  return logSpy.mock.calls.map(args => args.join(' ')).join('\n');
}

const RESULT = {
  changedFiles: ['src/a.ts'],
  affectedWorkspaces: [
    { name: 'web', path: 'apps/web', type: 'app', framework: 'react', dependencies: ['ui'] },
  ],
  totalImpact: 42,
  analysisTime: 5,
  buildOrder: ['ui', 'web'],
  testOrder: ['ui', 'web'],
  criticalPath: ['ui', 'web'],
  recommendations: ['Run tests for affected workspaces'],
};

const GRAPH = {
  nodes: new Map([
    ['web', { name: 'web', path: 'apps/web', type: 'app', framework: 'react' }],
    ['ui', { name: 'ui', path: 'packages/ui', type: 'package' }],
  ]),
  edges: new Map([['web', ['ui']]]),
  reverseEdges: new Map([['ui', ['web']]]),
};

const analyzer = {
  analyzeChangeImpact: mocks.analyze,
  getWorkspaceInfo: mocks.getWorkspaceInfo,
  getDependencyGraph: mocks.getDependencyGraph,
  getImpactVisualization: mocks.getImpactVisualization,
};

beforeAll(() => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-ci-'));
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{}', 'utf8');
  emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-ci-empty-'));
});

afterAll(() => {
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.rmSync(emptyDir, { recursive: true, force: true });
});

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset());
  process.exitCode = undefined;

  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir);

  mocks.createAnalyzer.mockResolvedValue(analyzer);
  mocks.analyze.mockResolvedValue(RESULT);
  mocks.getWorkspaceInfo.mockReturnValue(undefined);
  mocks.getDependencyGraph.mockReturnValue(GRAPH);
  mocks.getImpactVisualization.mockResolvedValue({
    nodes: [{ id: 'web', affected: true }, { id: 'ui', affected: false }],
    edges: [{ from: 'web', to: 'ui' }],
  });
});

afterEach(() => {
  logSpy.mockRestore();
  cwdSpy.mockRestore();
  process.exitCode = undefined;
});

describe('change-impact — manageChangeImpact (analyze)', () => {
  it('throws a ValidationError when not in a project (no package.json)', async () => {
    cwdSpy.mockReturnValue(emptyDir);
    await expect(manageChangeImpact({})).rejects.toBeInstanceOf(ValidationError);
    expect(mocks.createAnalyzer).not.toHaveBeenCalled();
  });

  it('analyzes all detected changes when no --files are given', async () => {
    await manageChangeImpact({});
    expect(mocks.analyze).toHaveBeenCalledWith();
  });

  it('analyzes the specified --files when provided', async () => {
    await manageChangeImpact({ files: ['src/a.ts', 'src/b.ts'] });
    expect(mocks.analyze).toHaveBeenCalledWith(['src/a.ts', 'src/b.ts']);
  });

  it('renders the text summary by default', async () => {
    await manageChangeImpact({});
    const out = logged();
    expect(out).toContain('Change Impact Analysis Results');
    expect(out).toContain('Changed files: 1');
    expect(out).toContain('Affected workspaces: 1');
    expect(out).toContain('web');
  });

  it('emits JSON when --format json', async () => {
    await manageChangeImpact({ format: 'json' });
    // The JSON document is one console.log call; locate + parse it.
    const json = JSON.parse(logSpy.mock.calls.map(a => a.join('')).find(s => s.startsWith('{'))!);
    expect(json.totalImpact).toBe(42);
    expect(json.buildOrder).toEqual(['ui', 'web']);
  });

  it('writes JSON to --output when given', async () => {
    const out = path.join(projectDir, 'impact.json');
    await manageChangeImpact({ format: 'json', output: out });
    expect(JSON.parse(fs.readFileSync(out, 'utf8')).totalImpact).toBe(42);
    expect(logged()).toContain('saved to');
  });

  it('renders a Mermaid diagram when --format mermaid', async () => {
    await manageChangeImpact({ format: 'mermaid' });
    const out = logged();
    expect(out).toContain('graph TD');
    expect(out).toContain('web --> ui');
  });

  it('renders visualization data when --visualization', async () => {
    await manageChangeImpact({ visualization: true });
    const json = JSON.parse(logSpy.mock.calls.map(a => a.join('')).find(s => s.startsWith('{'))!);
    expect(json.metadata.affectedNodes).toBe(1);
    expect(json.metadata.totalNodes).toBe(2);
  });

  it('saves text output to --output in the default format', async () => {
    const out = path.join(projectDir, 'impact.txt');
    await manageChangeImpact({ output: out });
    const content = fs.readFileSync(out, 'utf8');
    expect(content).toContain('Change Impact Analysis Results');
    expect(logged()).toContain('saved to');
  });

  it('wraps a non-ValidationError as a ValidationError', async () => {
    mocks.analyze.mockRejectedValue(new Error('boom'));
    let caught: unknown;
    try {
      await manageChangeImpact({});
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as Error).message).toContain('Change impact analysis failed');
    expect((caught as Error).message).toContain('boom');
  });

  it('rethrows a ValidationError as-is (no double-wrapping)', async () => {
    const ve = new ValidationError('original');
    mocks.analyze.mockRejectedValue(ve);
    await expect(manageChangeImpact({})).rejects.toBe(ve);
  });
});

describe('change-impact — analyzeWorkspaceImpact', () => {
  it('throws when the named workspace is not found', async () => {
    mocks.getWorkspaceInfo.mockReturnValue(undefined);
    await expect(analyzeWorkspaceImpact('ghost', {})).rejects.toThrow("Workspace 'ghost' not found");
  });

  it('analyzes the workspace directory files and renders the report', async () => {
    // Absolute path: getWorkspaceFiles calls fs.readdir(workspace.path) directly,
    // which resolves relative paths against the OS-level cwd (not the mocked
    // process.cwd()), so point it at the real on-disk temp project dir.
    mocks.getWorkspaceInfo.mockReturnValue({ name: 'web', path: path.join(projectDir, 'apps/web'), type: 'app' });
    // Create a couple of files under apps/web so getWorkspaceFiles scans them.
    fs.mkdirSync(path.join(projectDir, 'apps/web/src'), { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'apps/web/src/index.ts'), '', 'utf8');
    await analyzeWorkspaceImpact('web', {});
    // analyzeChangeImpact received the scanned file(s).
    const files = mocks.analyze.mock.calls[0][0] as string[];
    expect(files.some(f => f.endsWith('index.ts'))).toBe(true);
    expect(logged()).toContain('Impact Analysis for Workspace: web');
  });
});

describe('change-impact — showDependencyGraph', () => {
  it('renders a text dependency graph by default', async () => {
    await showDependencyGraph({});
    const out = logged();
    expect(out).toContain('Workspace Dependency Graph');
    expect(out).toContain('web');
    expect(out).toContain('web → ui');
  });

  it('emits graph JSON (nodes/edges/reverseEdges) when --format json', async () => {
    await showDependencyGraph({ format: 'json' });
    const json = JSON.parse(logSpy.mock.calls.map(a => a.join('')).find(s => s.startsWith('{'))!);
    expect(json.edges).toEqual({ web: ['ui'] });
    expect(json.reverseEdges).toEqual({ ui: ['web'] });
    expect(json.nodes).toHaveLength(2);
  });

  it('renders a Mermaid graph when --format mermaid', async () => {
    await showDependencyGraph({ format: 'mermaid' });
    const out = logged();
    expect(out).toContain('graph TD');
    expect(out).toContain('web[App]');
  });

  it('writes the mermaid graph to --output when given', async () => {
    const out = path.join(projectDir, 'graph.mmd');
    await showDependencyGraph({ format: 'mermaid', output: out });
    expect(fs.readFileSync(out, 'utf8')).toContain('graph TD');
    expect(logged()).toContain('saved to');
  });
});
