import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { manageWorkspaceHealth } from '../../src/commands/workspace-health';
import { ValidationError } from '../../src/utils/error-handler';

// UNIT coverage for src/commands/workspace-health.ts — the `workspace-health`
// command (check/topology/quick/fix/interactive/default-status). Complements the
// existing workspace-health.test.ts ENGINE suite (PR #300). Here we mock the
// health engine (createWorkspaceHealthChecker + performQuickHealthCheck) and the
// json-output helpers, use real on-disk temp files for fs.pathExists discovery,
// and no-op process.exit so the unhealthy/invalid exit(1) gates don't kill the
// runner. The watch action (indefinite loop) is intentionally not exercised.

const mocks = vi.hoisted(() => ({
  performHealthCheck: vi.fn(),
  validateTopology: vi.fn(),
  createWorkspaceHealthChecker: vi.fn(),
  performQuickHealthCheck: vi.fn(),
  jsonSuccess: vi.fn(),
  jsonError: vi.fn(),
  enableJsonMode: vi.fn(),
  prompts: vi.fn(),
}));

vi.mock('../../src/utils/workspace-health', () => ({
  createWorkspaceHealthChecker: mocks.createWorkspaceHealthChecker,
  performQuickHealthCheck: mocks.performQuickHealthCheck,
}));
vi.mock('../../src/utils/json-output', () => ({
  jsonSuccess: mocks.jsonSuccess,
  jsonError: mocks.jsonError,
  enableJsonMode: mocks.enableJsonMode,
}));
vi.mock('prompts', () => ({ default: mocks.prompts }));

const HEALTHY_REPORT = {
  timestamp: '2026-01-01T00:00:00.000Z',
  duration: 42,
  overall: { status: 'healthy', score: 95, summary: 'all healthy' },
  metrics: { workspaceCount: 2, dependencyCount: 1, cycleCount: 0, orphanedCount: 0, coverageScore: 100 },
  categories: [
    {
      id: 'structure',
      name: 'Structure',
      description: 'structure checks',
      summary: { score: 100, passed: 5, failed: 0, warnings: 0 },
      checks: [{ id: 'c1', name: 'dirs', status: 'pass', message: 'ok' }],
    },
    {
      id: 'security',
      name: 'Security',
      description: 'security checks',
      summary: { score: 90, passed: 1, failed: 0, warnings: 1 },
      checks: [{ id: 'c2', name: 'auth', status: 'warning', message: 'no auth' }],
    },
  ],
  recommendations: ['enable auth'],
};
const UNHEALTHY_REPORT = {
  ...HEALTHY_REPORT,
  overall: { status: 'unhealthy', score: 40, summary: 'significant issues' },
  categories: [
    {
      id: 'build',
      name: 'Build',
      description: 'build checks',
      summary: { score: 30, passed: 0, failed: 1, warnings: 0 },
      checks: [{ id: 'c3', name: 'build-script', status: 'fail', message: 'no build', suggestions: ['add build'] }],
    },
  ],
};
const VALID_TOPOLOGY = {
  isValid: true,
  structure: { depth: 2, breadth: 3, complexity: 1.5, balance: 0.8 },
  errors: [],
  warnings: ['deep'],
  suggestions: ['split'],
};
const HEALTHY_QUICK = { status: 'healthy', score: 95, criticalIssues: 0 };
const UNHEALTHY_QUICK = { status: 'unhealthy', score: 30, criticalIssues: 2 };

let tmp: string;
let existingFile: string;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-whc-'));
  existingFile = path.join(tmp, 're-shell.workspaces.yaml');
  fs.writeFileSync(existingFile, '');
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

let logSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

function out(): string {
  return logSpy.mock.calls.map(a => a.join(' ')).join('\n');
}
function spinner() {
  return {
    setText: vi.fn(), stop: vi.fn(), start: vi.fn(), succeed: vi.fn(), fail: vi.fn(), warn: vi.fn(),
  } as any;
}

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset());
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  mocks.enableJsonMode.mockReturnValue(vi.fn());
  mocks.createWorkspaceHealthChecker.mockResolvedValue({
    performHealthCheck: mocks.performHealthCheck,
    validateTopology: mocks.validateTopology,
  });
  mocks.performHealthCheck.mockResolvedValue(HEALTHY_REPORT);
  mocks.validateTopology.mockResolvedValue(VALID_TOPOLOGY);
  mocks.performQuickHealthCheck.mockResolvedValue(HEALTHY_QUICK);
});

afterEach(() => {
  logSpy.mockRestore();
  exitSpy.mockRestore();
});

describe('workspace-health command — check', () => {
  it('reports when no workspace definition is found (human)', async () => {
    await manageWorkspaceHealth({ file: path.join(tmp, 'missing.yaml'), check: true });
    expect(out()).toContain('No workspace definition found');
  });

  it('emits a jsonError when no definition is found in json mode', async () => {
    await manageWorkspaceHealth({ file: path.join(tmp, 'missing.yaml'), check: true, json: true });
    expect(mocks.jsonError).toHaveBeenCalledWith('WORKSPACE_NOT_FOUND', expect.any(String));
  });

  it('renders a healthy report and does not exit', async () => {
    await manageWorkspaceHealth({ file: existingFile, check: true });
    expect(out()).toContain('Workspace Health Report');
    expect(out()).toContain('Overall:');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits 1 when the report is unhealthy', async () => {
    mocks.performHealthCheck.mockResolvedValue(UNHEALTHY_REPORT);
    await manageWorkspaceHealth({ file: existingFile, check: true });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('emits the report via jsonSuccess with collected warning messages in json mode', async () => {
    await manageWorkspaceHealth({ file: existingFile, check: true, json: true });
    expect(mocks.jsonSuccess).toHaveBeenCalledTimes(1);
    const [report, warnings] = mocks.jsonSuccess.mock.calls[0];
    expect(report.overall.status).toBe('healthy');
    expect(warnings).toContain('no auth'); // from the security warning check
  });

  it('saves the report to --output', async () => {
    const outFile = path.join(tmp, 'report.json');
    await manageWorkspaceHealth({ file: existingFile, check: true, output: outFile });
    expect(fs.existsSync(outFile)).toBe(true);
    expect(out()).toContain('Health report saved to');
  });

  it('renders only the filtered category when --category is given', async () => {
    await manageWorkspaceHealth({ file: existingFile, check: true, category: 'security' });
    expect(out()).toContain('Security');
    expect(out()).not.toContain('Structure');
  });
});

describe('workspace-health command — topology', () => {
  it('renders a valid topology and does not exit', async () => {
    await manageWorkspaceHealth({ file: existingFile, topology: true });
    expect(out()).toContain('Topology Validation');
    expect(out()).toContain('VALID');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits 1 when the topology is invalid', async () => {
    mocks.validateTopology.mockResolvedValue({ ...VALID_TOPOLOGY, isValid: false, errors: [{ message: 'cycle' }] });
    await manageWorkspaceHealth({ file: existingFile, topology: true });
    expect(out()).toContain('INVALID');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('emits the topology via jsonSuccess in json mode', async () => {
    await manageWorkspaceHealth({ file: existingFile, topology: true, json: true });
    const [validation, warnings] = mocks.jsonSuccess.mock.calls[0];
    expect(validation.isValid).toBe(true);
    expect(warnings).toContain('deep');
  });
});

describe('workspace-health command — quick', () => {
  it('renders a healthy quick result and does not exit', async () => {
    await manageWorkspaceHealth({ file: existingFile, quick: true });
    expect(out()).toContain('Quick Health Check');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits 1 when the quick result is unhealthy', async () => {
    mocks.performQuickHealthCheck.mockResolvedValue(UNHEALTHY_QUICK);
    await manageWorkspaceHealth({ file: existingFile, quick: true });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('emits the quick result via jsonSuccess with a critical-issues warning', async () => {
    mocks.performQuickHealthCheck.mockResolvedValue(UNHEALTHY_QUICK);
    await manageWorkspaceHealth({ file: existingFile, quick: true, json: true });
    const [, warnings] = mocks.jsonSuccess.mock.calls[0];
    expect(warnings.some((w: string) => w.includes('critical issues'))).toBe(true);
  });
});

describe('workspace-health command — fix', () => {
  it('reports when no workspace definition is found', async () => {
    await manageWorkspaceHealth({ file: path.join(tmp, 'missing.yaml'), fix: true });
    expect(out()).toContain('No workspace definition found');
  });

  it('reports no auto-fixable issues when the workspace is healthy', async () => {
    await manageWorkspaceHealth({ file: existingFile, fix: true });
    expect(out()).toContain('No auto-fixable issues found');
  });

  it('lists fixable issues when checks fail with suggestions', async () => {
    mocks.performHealthCheck.mockResolvedValue(UNHEALTHY_REPORT);
    await manageWorkspaceHealth({ file: existingFile, fix: true });
    const o = out();
    expect(o).toContain('1 potentially fixable');
    expect(o).toContain('add build');
    expect(o).toContain('coming in next update');
  });
});

describe('workspace-health command — default status', () => {
  it('reports when no definition is found (human)', async () => {
    await manageWorkspaceHealth({ file: path.join(tmp, 'missing.yaml') });
    expect(out()).toContain('No workspace definition found');
  });

  it('renders the health status when the definition exists', async () => {
    await manageWorkspaceHealth({ file: existingFile });
    const o = out();
    expect(o).toContain('Workspace Health Status');
    expect(o).toContain('HEALTHY');
    expect(o).toContain('Critical Issues: None');
  });

  it('emits the status via jsonSuccess in json mode', async () => {
    await manageWorkspaceHealth({ file: existingFile, json: true });
    expect(mocks.jsonSuccess).toHaveBeenCalledTimes(1);
  });
});

describe('workspace-health command — interactive', () => {
  it('reports when no definition is found', async () => {
    await manageWorkspaceHealth({ file: path.join(tmp, 'missing.yaml'), interactive: true });
    expect(out()).toContain('No workspace definition found');
  });

  it('returns early when the action is cancelled', async () => {
    mocks.prompts.mockResolvedValue({ action: undefined });
    await manageWorkspaceHealth({ file: existingFile, interactive: true });
    expect(mocks.performQuickHealthCheck).not.toHaveBeenCalled();
  });

  it('dispatches to status when the user picks status', async () => {
    mocks.prompts.mockResolvedValue({ action: 'status' });
    await manageWorkspaceHealth({ file: existingFile, interactive: true });
    expect(out()).toContain('Workspace Health Status');
  });
});

describe('workspace-health command — error handling', () => {
  it('reports a missing definition and exits when the engine throws a ValidationError', async () => {
    mocks.performQuickHealthCheck.mockRejectedValue(new ValidationError('missing'));
    // The command's catch logs the missing-definition notice + exit(1), then rethrows.
    await expect(manageWorkspaceHealth({ file: existingFile })).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(out()).toContain('No workspace definition found');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('fails the spinner and rethrows on a generic engine error', async () => {
    mocks.performQuickHealthCheck.mockRejectedValue(new Error('engine boom'));
    const s = spinner();
    await expect(manageWorkspaceHealth({ file: existingFile, spinner: s })).rejects.toThrow('engine boom');
    expect(s.fail).toHaveBeenCalled();
  });
});
