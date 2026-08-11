import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runScorecard } from '../../src/commands/scorecard';

// Covers src/commands/scorecard.ts (the `re-shell scorecard` command). The
// command orchestrates several already-tested modules — the PURE scorecard-engine
// plus health/policy/drift gatherers. We mock the I/O signal sources and the
// workspace parser, then drive the REAL pure engine with deterministic inputs so
// the command's own orchestration is what's under test: config discovery, the
// --service filter, graceful signal degradation, the CI gate, and the JSON/human
// renders. Config discovery is exercised against real on-disk temp dirs (the
// parser is mocked, so the config file's contents are irrelevant). The engine
// itself is covered by scorecard.test.ts.

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  loadWorkspaceDefinition: vi.fn(),
  performQuickHealthCheck: vi.fn(),
  normalizeHealth: vi.fn(),
  resolvePolicyPack: vi.fn(),
  evaluatePolicyPack: vi.fn(),
  detectDependencyDrift: vi.fn(),
}));

vi.mock('../../src/parsers/workspace-parser', () => ({
  // Every `new WorkspaceParser()` yields an instance whose parse() is our spy.
  WorkspaceParser: vi.fn().mockImplementation(() => ({ parse: mocks.parse })),
}));
vi.mock('../../src/utils/workspace-health', () => ({
  performQuickHealthCheck: mocks.performQuickHealthCheck,
}));
vi.mock('../../src/utils/workspace-schema', () => ({
  loadWorkspaceDefinition: mocks.loadWorkspaceDefinition,
}));
vi.mock('../../src/utils/health-normalizer', () => ({
  normalizeHealth: mocks.normalizeHealth,
}));
vi.mock('../../src/utils/policy-engine', () => ({
  resolvePolicyPack: mocks.resolvePolicyPack,
  evaluatePolicyPack: mocks.evaluatePolicyPack,
}));
vi.mock('../../src/utils/dependency-drift', () => ({
  detectDependencyDrift: mocks.detectDependencyDrift,
}));

// Real on-disk project dirs so the command's fs.existsSync config discovery
// works without mocking the `fs` module (whose namespace methods vi cannot
// reliably replace). The parser is mocked, so the config file's CONTENTS are
// irrelevant — only its existence matters.
let projectDir: string; // contains re-shell.workspaces.yaml
let emptyDir: string; // no config file at all

beforeAll(() => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-sc-'));
  fs.writeFileSync(path.join(projectDir, 're-shell.workspaces.yaml'), '');
  emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-sc-empty-'));
});

afterAll(() => {
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.rmSync(emptyDir, { recursive: true, force: true });
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
/** Parse the single JSON envelope emitted on stdout in --json mode. */
function jsonOut(): any {
  return JSON.parse(stdout());
}

/** A fully-featured service that scores 100 when every signal is 100. */
function fullServices() {
  return {
    valid: true,
    config: {
      services: {
        web: {
          path: 'apps/web',
          scripts: { build: 'vite build', test: 'vitest' },
          healthCheck: { path: '/health' },
          port: 3000,
        },
        api: {
          path: 'apps/api',
          scripts: { build: 'tsc', test: 'vitest' },
          healthCheck: { path: '/healthz' },
        },
      },
    },
    errors: [],
  };
}

beforeEach(() => {
  // mockReset clears each hoisted spy's call history AND one-off queue /
  // implementation, then we re-establish a healthy default baseline per test.
  Object.values(mocks).forEach(m => m.mockReset());
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

  mocks.parse.mockReturnValue(fullServices());
  mocks.loadWorkspaceDefinition.mockResolvedValue({});
  mocks.performQuickHealthCheck.mockResolvedValue({});
  mocks.normalizeHealth.mockReturnValue({ score: 100 });
  mocks.resolvePolicyPack.mockResolvedValue({});
  mocks.evaluatePolicyPack.mockReturnValue({ score: 100 });
  mocks.detectDependencyDrift.mockReturnValue({ drift: [] });
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
  process.exitCode = undefined;
});

describe('scorecard — config discovery', () => {
  it('emits a SCORECARD_ERROR json envelope when no workspace config exists', async () => {
    await runScorecard({ json: true, threshold: 80, cwd: emptyDir });
    const out = jsonOut();
    expect(out.ok).toBe(false);
    expect(out.error.code).toBe('SCORECARD_ERROR');
    expect(out.error.message).toContain('No workspace config found');
    expect(out.error.message).toContain('re-shell.workspaces.yaml');
    expect(out.error.message).toContain(emptyDir);
    expect(process.exitCode).toBe(1);
  });

  it('writes a red human error to stderr when no workspace config exists', async () => {
    await runScorecard({ threshold: 80, cwd: emptyDir });
    expect(stderr()).toContain('No workspace config found');
    expect(stdout()).toBe('');
    expect(process.exitCode).toBe(1);
  });
});

describe('scorecard — parse / loadServices', () => {
  it('reports an invalid workspace config via the json error envelope', async () => {
    mocks.parse.mockReturnValue({
      valid: false,
      config: undefined,
      errors: [
        { path: 'services.web', message: 'is required' },
        { path: 'version', message: 'invalid' },
      ],
    });
    await runScorecard({ json: true, threshold: 80, cwd: projectDir });
    const out = jsonOut();
    expect(out.ok).toBe(false);
    expect(out.error.message).toContain('Invalid workspace config');
    expect(out.error.message).toContain('services.web: is required');
    expect(out.error.message).toContain('version: invalid');
    expect(process.exitCode).toBe(1);
  });

  it('falls back to "unknown error" when the parse errors list is empty', async () => {
    mocks.parse.mockReturnValue({ valid: false, config: undefined, errors: [] });
    await runScorecard({ json: true, threshold: 80, cwd: projectDir });
    expect(jsonOut().error.message).toBe('Invalid workspace config: unknown error');
  });

  it('renders the parse error to stderr in human mode', async () => {
    mocks.parse.mockReturnValue({
      valid: false,
      config: undefined,
      errors: [{ path: 'services', message: 'required' }],
    });
    await runScorecard({ threshold: 80, cwd: projectDir });
    expect(stderr()).toContain('Invalid workspace config: services: required');
    expect(process.exitCode).toBe(1);
  });
});

describe('scorecard — signal gathering & degradation', () => {
  it('uses the normalised health score when a v1 workspace definition applies', async () => {
    mocks.normalizeHealth.mockReturnValue({ score: 73 });
    await runScorecard({ json: true, threshold: 80, cwd: projectDir });
    const svc = jsonOut().data.services[0];
    const health = svc.dimensions.find((d: any) => d.id === 'health');
    expect(health.score).toBe(73);
    expect(health.detail).toBeUndefined();
    expect(jsonOut().data.warnings).toEqual([]);
  });

  it('degrades the health signal to a neutral 100 with a warning when the check throws', async () => {
    mocks.performQuickHealthCheck.mockRejectedValue(new Error('probe failed'));
    await runScorecard({ json: true, threshold: 80, cwd: projectDir });
    const data = jsonOut().data;
    const health = data.services[0].dimensions.find((d: any) => d.id === 'health');
    expect(health.score).toBe(100); // degraded to neutral
    expect(data.warnings).toEqual(
      expect.arrayContaining(['health signal degraded: probe failed'])
    );
  });

  it('neutralises health (not-applicable, no warning) when no v1 definition loads', async () => {
    mocks.loadWorkspaceDefinition.mockRejectedValue(new Error('no v1 def'));
    await runScorecard({ json: true, threshold: 80, cwd: projectDir });
    const data = jsonOut().data;
    const health = data.services[0].dimensions.find((d: any) => d.id === 'health');
    expect(health.score).toBe(100);
    expect(health.detail).toContain('not-applicable');
    expect(data.warnings).not.toContain(
      expect.stringContaining('health signal degraded')
    );
  });

  it('degrades the policy signal to a neutral 100 with a warning when evaluation throws', async () => {
    mocks.evaluatePolicyPack.mockRejectedValue(new Error('pack missing'));
    await runScorecard({ json: true, threshold: 80, cwd: projectDir });
    const data = jsonOut().data;
    expect(data.policyScore).toBe(100); // degraded to neutral
    expect(data.warnings).toEqual(
      expect.arrayContaining(['policy signal degraded: pack missing'])
    );
  });

  it('scores drift as 100 - 10*N and reports the entry count', async () => {
    mocks.detectDependencyDrift.mockReturnValue({ drift: [{}, {}, {}] });
    await runScorecard({ json: true, threshold: 80, cwd: projectDir });
    const data = jsonOut().data;
    expect(data.driftEntries).toBe(3);
    const drift = data.services[0].dimensions.find((d: any) => d.id === 'drift');
    expect(drift.score).toBe(70); // 100 - 3*10
  });

  it('clamps the drift score at 0 for many entries', async () => {
    mocks.detectDependencyDrift.mockReturnValue({ drift: Array.from({ length: 15 }) });
    await runScorecard({ json: true, threshold: 80, cwd: projectDir });
    const drift = jsonOut().data.services[0].dimensions.find((d: any) => d.id === 'drift');
    expect(drift.score).toBe(0);
  });

  it('degrades the drift signal to a neutral 100 when detection throws', async () => {
    mocks.detectDependencyDrift.mockRejectedValue(new Error('drift boom'));
    await runScorecard({ json: true, threshold: 80, cwd: projectDir });
    const data = jsonOut().data;
    expect(data.driftEntries).toBe(0);
    const drift = data.services[0].dimensions.find((d: any) => d.id === 'drift');
    expect(drift.score).toBe(100);
    expect(data.warnings).toEqual(
      expect.arrayContaining(['drift signal degraded: drift boom'])
    );
  });
});

describe('scorecard — --service filter', () => {
  it('errors when the requested service is unknown (json)', async () => {
    await runScorecard({ json: true, threshold: 80, cwd: projectDir, service: 'ghost' });
    const out = jsonOut();
    expect(out.ok).toBe(false);
    expect(out.error.message).toContain('Unknown service "ghost"');
    expect(out.error.message).toContain('Known services: web, api');
    expect(process.exitCode).toBe(1);
  });

  it('scopes the report to the single requested service when known', async () => {
    await runScorecard({ json: true, threshold: 80, cwd: projectDir, service: 'api' });
    const services = jsonOut().data.services;
    expect(services).toHaveLength(1);
    expect(services[0].service).toBe('api');
  });

  it('renders the unknown-service error to stderr in human mode', async () => {
    await runScorecard({ threshold: 80, cwd: projectDir, service: 'ghost' });
    expect(stderr()).toContain('Unknown service "ghost"');
    expect(process.exitCode).toBe(1);
  });
});

describe('scorecard — JSON envelope & CI gate', () => {
  it('emits a passing success envelope (score 100, grade A) and leaves exitCode unset', async () => {
    await runScorecard({ json: true, threshold: 80, cwd: projectDir });
    const env = jsonOut();
    expect(env.ok).toBe(true);
    expect(env.data.score).toBe(100);
    expect(env.data.grade).toBe('A');
    expect(env.data.pass).toBe(true);
    expect(env.data.threshold).toBe(80);
    expect(env.data.services).toHaveLength(2);
    expect(env.data.policyScore).toBe(100);
    expect(env.data.driftEntries).toBe(0);
    expect(process.exitCode).toBeUndefined();
  });

  it('still emits the full advisory payload but exits non-zero when below threshold', async () => {
    // policy 0 → web/api total 75 (health/drift/build/tests/health-endpoint 100).
    mocks.evaluatePolicyPack.mockReturnValue({ score: 0 });
    await runScorecard({ json: true, threshold: 80, cwd: projectDir });
    const env = jsonOut();
    expect(env.ok).toBe(true); // advisory data, not an error envelope
    expect(env.data.score).toBe(75);
    expect(env.data.grade).toBe('C');
    expect(env.data.pass).toBe(false);
    expect(env.data.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('below the threshold of 80'),
      ])
    );
    expect(process.exitCode).toBe(1);
  });
});

describe('scorecard — human render', () => {
  it('renders the header, per-service grades and a PASS rollup line', async () => {
    await runScorecard({ threshold: 80, cwd: projectDir });
    const out = stdout();
    expect(out).toContain('production-readiness scorecard');
    expect(out).toContain('web');
    expect(out).toContain('api');
    expect(out).toContain('PASS');
    expect(out).toContain('threshold 80');
    expect(process.exitCode).toBeUndefined();
  });

  it('notes which dimensions a service is failing', async () => {
    // A bare service with no scripts / health signals: build, tests and
    // health-endpoint dimensions all score 0 (well below the 60 pass bar).
    mocks.parse.mockReturnValue({
      valid: true,
      config: { services: { bare: { path: 'apps/bare' } } },
      errors: [],
    });
    await runScorecard({ threshold: 50, cwd: projectDir });
    expect(stdout()).toContain('failing: has-build, has-tests, has-health-endpoint');
  });

  it('renders "No services to score" and a neutral rollup for an empty workspace', async () => {
    mocks.parse.mockReturnValue({ valid: true, config: { services: {} }, errors: [] });
    await runScorecard({ threshold: 80, cwd: projectDir });
    const out = stdout();
    expect(out).toContain('No services to score.');
    expect(out).toContain('PASS');
    expect(out).toContain('no services found');
  });

  it('renders a FAIL rollup line and exits non-zero when below threshold', async () => {
    mocks.evaluatePolicyPack.mockReturnValue({ score: 0 });
    await runScorecard({ threshold: 80, cwd: projectDir });
    expect(stdout()).toContain('FAIL');
    expect(process.exitCode).toBe(1);
  });

  it('renders gathered warnings as yellow "! <message>" lines', async () => {
    mocks.performQuickHealthCheck.mockRejectedValue(new Error('probe failed'));
    await runScorecard({ threshold: 80, cwd: projectDir });
    expect(stdout()).toContain('! health signal degraded: probe failed');
  });
});
