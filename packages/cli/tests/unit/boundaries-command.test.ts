import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runBoundaries } from '../../src/commands/boundaries';
import { DEFAULT_BOUNDARY_RULES } from '../../src/utils/boundaries-engine';

// UNIT coverage for src/commands/boundaries.ts — the `re-shell boundaries` CI
// gate (issue #20). Complements the existing boundaries.test.ts INTEGRATION suite
// (which uses real on-disk workspace discovery). Here we mock workspace discovery
// + the spinner and drive the REAL boundaries-engine with synthetic tagged
// packages + import edges, so the command's own branches are exercised directly:
// discovery error/empty handling, edge resolution (injected vs graph), --rules
// loading edge cases, the violation gate, and the JSON/human renders. A real temp
// cwd is used so --rules paths resolve against on-disk JSON files.

const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
}));

vi.mock('../../src/utils/task-runner', () => ({
  discoverWorkspace: mocks.discover,
}));
vi.mock('../../src/utils/spinner', () => ({
  // The human path starts/stops a spinner; stub it so it never touches the tty.
  createSpinner: vi.fn(() => ({ start: () => {}, stop: () => {}, succeed: () => {}, fail: () => {} })),
}));

let projectDir: string;

beforeAll(() => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-bnd-'));
});

afterAll(() => {
  fs.rmSync(projectDir, { recursive: true, force: true });
});

let stdoutChunks: string[];
let stderrChunks: string[];
let stdoutSpy: ReturnType<typeof vi.spyOn>;
let stderrSpy: ReturnType<typeof vi.spyOn>;

function stdout(): string {
  return stdoutChunks.join('');
}
function stderr(): string {
  return stderrChunks.join('');
}
function jsonOut(): any {
  return JSON.parse(stdout());
}

/** Build a discovery result from a simple package/deps/graph declaration. */
function discover(packages: Record<string, string[]>, graph: Record<string, string[]>) {
  return {
    packages: new Map(
      Object.entries(packages).map(([name, deps]) => [name, { workspaceDeps: deps }])
    ),
    graph: new Map(Object.entries(graph)),
  };
}

beforeEach(() => {
  mocks.discover.mockReset();
  process.exitCode = undefined;
  stdoutChunks = [];
  stderrChunks = [];

  stdoutSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(((chunk: any) => {
      stdoutChunks.push(String(chunk));
      return true;
    }) as any);
  stderrSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation(((chunk: any) => {
      stderrChunks.push(String(chunk));
      return true;
    }) as any);
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
  process.exitCode = undefined;
});

describe('boundaries — discovery', () => {
  it('reports a discovery failure via the BOUNDARIES_ERROR json envelope', async () => {
    mocks.discover.mockRejectedValue(new Error('not a workspace'));
    await runBoundaries({ json: true, cwd: projectDir });
    const out = jsonOut();
    expect(out.ok).toBe(false);
    expect(out.error.code).toBe('BOUNDARIES_ERROR');
    expect(out.error.message).toBe('not a workspace');
    expect(process.exitCode).toBe(1);
  });

  it('renders the discovery error to stderr in human mode', async () => {
    mocks.discover.mockRejectedValue(new Error('not a workspace'));
    await runBoundaries({ cwd: projectDir });
    expect(stderr()).toContain('not a workspace');
    expect(process.exitCode).toBe(1);
  });

  it('errors when discovery resolves with no packages', async () => {
    mocks.discover.mockReturnValue(discover({}, {}));
    await runBoundaries({ json: true, cwd: projectDir });
    expect(jsonOut().error.message).toBe('No workspace packages discovered.');
    expect(process.exitCode).toBe(1);
  });
});

describe('boundaries — default ruleset, edges from graph', () => {
  it('passes a clean graph (declared deps, no rule match) and leaves exitCode unset', async () => {
    mocks.discover.mockReturnValue(
      discover({ app: ['lib'], lib: [] }, { app: ['lib'] })
    );
    await runBoundaries({ json: true, cwd: projectDir });
    const data = jsonOut().data;
    expect(data.pass).toBe(true);
    expect(data.violations).toEqual([]);
    expect(data.disallowedCount).toBe(0);
    expect(data.undeclaredCount).toBe(0);
    expect(data.rules).toBe(DEFAULT_BOUNDARY_RULES.length);
    expect(process.exitCode).toBeUndefined();
  });

  it('flags a disallowed domain→ui import (default rule no-domain-imports-ui)', async () => {
    mocks.discover.mockReturnValue(
      discover(
        { 'core-thing': ['ui-components'], 'ui-components': [] },
        { 'core-thing': ['ui-components'] }
      )
    );
    await runBoundaries({ json: true, cwd: projectDir });
    const data = jsonOut().data;
    expect(data.pass).toBe(false);
    expect(data.disallowedCount).toBe(1);
    expect(data.undeclaredCount).toBe(0); // ui-components IS declared
    const v = data.violations[0];
    expect(v.kind).toBe('disallowed-import');
    expect(v.ruleId).toBe('no-domain-imports-ui');
    expect(process.exitCode).toBe(1);
  });

  it('flags an undeclared dependency when an edge target is not in declaredDeps', async () => {
    mocks.discover.mockReturnValue(
      discover({ app: [], lib: [] }, { app: ['lib'] })
    );
    await runBoundaries({ json: true, cwd: projectDir });
    const data = jsonOut().data;
    expect(data.pass).toBe(false);
    expect(data.undeclaredCount).toBe(1);
    expect(data.disallowedCount).toBe(0); // both packages are type:package — no rule match
    expect(data.violations[0].kind).toBe('undeclared-dependency');
    expect(data.violations[0].ruleId).toBeUndefined();
    expect(process.exitCode).toBe(1);
  });

  it('emits both a disallowed-import and an undeclared-dependency for one offending edge', async () => {
    mocks.discover.mockReturnValue(
      discover(
        { 'core-thing': [], 'ui-components': [] },
        { 'core-thing': ['ui-components'] }
      )
    );
    await runBoundaries({ json: true, cwd: projectDir });
    const data = jsonOut().data;
    expect(data.disallowedCount).toBe(1);
    expect(data.undeclaredCount).toBe(1);
    expect(data.violations).toHaveLength(2);
  });

  it('ignores self-imports', async () => {
    mocks.discover.mockReturnValue(
      discover({ app: [], lib: [] }, { app: ['app'] })
    );
    await runBoundaries({ json: true, cwd: projectDir });
    expect(jsonOut().data.violations).toEqual([]);
  });
});

describe('boundaries — injected edges', () => {
  it('uses options.edges and ignores the discovered graph', async () => {
    mocks.discover.mockReturnValue(
      // Graph says app→lib (would be clean), but injected edge flags core-thing→ui-components.
      discover(
        { app: ['lib'], lib: [], 'core-thing': [], 'ui-components': [] },
        { app: ['lib'] }
      )
    );
    await runBoundaries({
      json: true,
      cwd: projectDir,
      edges: [{ from: 'core-thing', to: 'ui-components' }],
    });
    const data = jsonOut().data;
    // The injected core-thing→ui-components edge is used (its violations appear)
    // and the graph's app→lib edge is ignored (no 'app' violation).
    expect(data.violations.length).toBeGreaterThan(0);
    expect(
      data.violations.every((v: any) => v.from === 'core-thing' && v.to === 'ui-components')
    ).toBe(true);
    expect(data.violations.some((v: any) => v.from === 'app')).toBe(false);
  });

  it('carries the edge file path through to the violation', async () => {
    mocks.discover.mockReturnValue(
      discover({ app: [], lib: [] }, { app: ['lib'] })
    );
    await runBoundaries({
      json: true,
      cwd: projectDir,
      edges: [{ from: 'app', to: 'lib', file: 'src/app/index.ts' }],
    });
    expect(jsonOut().data.violations[0].file).toBe('src/app/index.ts');
  });
});

describe('boundaries — --rules loading', () => {
  function writeRules(name: string, content: string): string {
    const p = path.join(projectDir, name);
    fs.writeFileSync(p, content, 'utf8');
    return name;
  }

  it('uses a custom ruleset file and replaces the defaults', async () => {
    // Custom rule flags type:package → type:package; the clean graph (app→lib,
    // both type:package) would PASS under defaults but now violates the custom rule.
    const ruleName = writeRules(
      'custom.json',
      JSON.stringify([
        {
          id: 'custom-1',
          from: { type: 'package' },
          disallow: { type: 'package' },
          reason: 'packages must not import each other',
        },
      ])
    );
    mocks.discover.mockReturnValue(
      discover({ app: ['lib'], lib: [] }, { app: ['lib'] })
    );
    await runBoundaries({ json: true, cwd: projectDir, rules: ruleName });
    const data = jsonOut().data;
    expect(data.rules).toBe(1); // custom replaced the 3 defaults
    expect(data.disallowedCount).toBe(1);
    expect(data.violations[0].ruleId).toBe('custom-1');
    expect(data.warnings).toEqual([]);
  });

  it('falls back to defaults with a warning when the rules file is malformed JSON', async () => {
    const ruleName = writeRules('bad.json', '{ not json');
    mocks.discover.mockReturnValue(
      discover({ app: ['lib'], lib: [] }, { app: ['lib'] })
    );
    await runBoundaries({ json: true, cwd: projectDir, rules: ruleName });
    const data = jsonOut().data;
    expect(data.rules).toBe(DEFAULT_BOUNDARY_RULES.length);
    expect(data.violations).toEqual([]); // clean under defaults
    expect(data.warnings).toEqual([
      `could not load ruleset ${ruleName}; using defaults`,
    ]);
  });

  it('falls back to defaults when the rules file is valid JSON but not an array', async () => {
    const ruleName = writeRules('obj.json', '{"id":"x"}');
    mocks.discover.mockReturnValue(
      discover({ app: ['lib'], lib: [] }, { app: ['lib'] })
    );
    await runBoundaries({ json: true, cwd: projectDir, rules: ruleName });
    const data = jsonOut().data;
    expect(data.rules).toBe(DEFAULT_BOUNDARY_RULES.length);
    expect(data.warnings[0]).toContain('could not load ruleset');
  });

  it('keeps only well-formed rule entries from the file', async () => {
    const ruleName = writeRules(
      'mixed.json',
      JSON.stringify([
        {}, // missing id/reason/from/disallow — filtered
        { foo: 'bar' }, // missing required keys — filtered
        {
          id: 'ok-1',
          from: { type: 'package' },
          disallow: { type: 'package' },
          reason: 'r',
        }, // kept
      ])
    );
    mocks.discover.mockReturnValue(
      discover({ app: ['lib'], lib: [] }, { app: ['lib'] })
    );
    await runBoundaries({ json: true, cwd: projectDir, rules: ruleName });
    expect(jsonOut().data.rules).toBe(1);
  });

  it('falls back to defaults with a warning when the rules file is missing', async () => {
    mocks.discover.mockReturnValue(
      discover({ app: ['lib'], lib: [] }, { app: ['lib'] })
    );
    await runBoundaries({ json: true, cwd: projectDir, rules: 'nope.json' });
    const data = jsonOut().data;
    expect(data.rules).toBe(DEFAULT_BOUNDARY_RULES.length);
    expect(data.warnings[0]).toContain('could not load ruleset nope.json');
  });
});

describe('boundaries — JSON envelope & wire projection', () => {
  it('projects violations onto the wire shape (ruleId/file omitted when absent)', async () => {
    mocks.discover.mockReturnValue(
      discover({ app: [], lib: [] }, { app: ['lib'] })
    );
    await runBoundaries({ json: true, cwd: projectDir });
    const env = jsonOut();
    expect(env.ok).toBe(true);
    expect(env.data.pass).toBe(false);
    const v = env.data.violations[0];
    expect(v).toMatchObject({
      kind: 'undeclared-dependency',
      from: 'app',
      to: 'lib',
      message: expect.any(String),
    });
    expect(v).not.toHaveProperty('ruleId');
    expect(v).not.toHaveProperty('file');
  });
});

describe('boundaries — human render', () => {
  it('renders the no-violations PASS report', async () => {
    mocks.discover.mockReturnValue(
      discover({ app: ['lib'], lib: [] }, { app: ['lib'] })
    );
    await runBoundaries({ cwd: projectDir });
    const out = stdout();
    expect(out).toContain('no boundary violations');
    expect(out).toContain('PASS');
    expect(process.exitCode).toBeUndefined();
  });

  it('renders DISALLOWED-IMPORT / UNDECLARED-DEPENDENCY lines and a FAIL gate', async () => {
    mocks.discover.mockReturnValue(
      discover(
        { 'core-thing': [], 'ui-components': [] },
        { 'core-thing': ['ui-components'] }
      )
    );
    await runBoundaries({ cwd: projectDir });
    const out = stdout();
    expect(out).toContain('DISALLOWED-IMPORT');
    expect(out).toContain('UNDECLARED-DEPENDENCY');
    expect(out).toContain('FAIL');
    expect(out).toContain('1 disallowed');
    expect(out).toContain('1 undeclared');
    expect(process.exitCode).toBe(1);
  });

  it('renders a ruleset-load warning as a yellow "! <warning>" line', async () => {
    mocks.discover.mockReturnValue(
      discover({ app: ['lib'], lib: [] }, { app: ['lib'] })
    );
    await runBoundaries({ cwd: projectDir, rules: 'nope.json' });
    expect(stdout()).toContain('! could not load ruleset nope.json; using defaults');
  });
});
