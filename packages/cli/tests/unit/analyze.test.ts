import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fsReal from 'fs';
import { runProjectAnalysis } from '../../src/commands/analyze';
import { findMonorepoRoot } from '../../src/utils/monorepo';
import { jsonSuccess, jsonError } from '../../src/utils/json-output';

// Covers src/commands/analyze.ts (719 lines) — runProjectAnalysis, the
// monorepo-wide `analyze` command. findMonorepoRoot is pointed at a REAL
// temp monorepo (root package.json with workspaces + per-workspace
// package.json / dist / stats fixtures) so the analysis helpers exercise
// genuine filesystem reads. execSync (npm run build / npm outdated /
// npm audit) is mocked to avoid network + child processes.

vi.mock('../../src/utils/monorepo', () => ({
  findMonorepoRoot: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('../../src/utils/json-output', () => ({
  jsonSuccess: vi.fn(),
  jsonError: vi.fn(),
  enableJsonMode: vi.fn(() => () => {}),
}));

const findRoot = vi.mocked(findMonorepoRoot);
const execSyncMock = vi.mocked(
  (await import('child_process')).execSync
);

let logSpy: ReturnType<typeof vi.spyOn>;
let tmpDir: string;

/** A workspace package.json with build script and one dependency. */
function workspacePkg(): Record<string, unknown> {
  return {
    name: 'test-workspace',
    version: '1.0.0',
    type: 'module',
    dependencies: { react: '^18.0.0' },
    devDependencies: { typescript: '^5.0.0' },
    scripts: { build: 'vite build' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  tmpDir = fsReal.mkdtempSync(path.join(os.tmpdir(), 'analyze-cmd-'));

  // Root monorepo with two workspaces declared via workspaces.packages.
  const rootPkg = {
    name: 'test-monorepo',
    private: true,
    workspaces: { packages: ['apps/*', 'packages/*'] },
  };
  fsReal.writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify(rootPkg)
  );

  // Workspace one: buildable, with dist output + webpack stats.
  const ws1 = path.join(tmpDir, 'apps', 'shell');
  fsReal.mkdirSync(path.join(ws1, 'dist'), { recursive: true });
  fsReal.writeFileSync(
    path.join(ws1, 'package.json'),
    JSON.stringify(workspacePkg())
  );
  fsReal.writeFileSync(path.join(ws1, 'dist', 'index.js'), 'x'.repeat(2048));
  fsReal.writeFileSync(path.join(ws1, 'dist', 'style.css'), 'y'.repeat(512));
  fsReal.writeFileSync(
    path.join(ws1, 'stats.json'),
    JSON.stringify({
      chunks: [{ names: ['main'], size: 1024, modules: [{}, {}, {}] }],
      modules: [
        { name: 'src/a.ts', usedExports: false, providedExports: ['a', 'b'], usedExportsList: ['a'] },
        { name: 'src/b.ts', providedExports: ['c', 'd', 'e'], usedExports: ['c'] },
      ],
    })
  );

  // Workspace two: not buildable (no build script) — exercises the N/A paths.
  const ws2 = path.join(tmpDir, 'packages', 'ui-kit');
  fsReal.mkdirSync(ws2, { recursive: true });
  fsReal.writeFileSync(
    path.join(ws2, 'package.json'),
    JSON.stringify({ name: 'ui-kit', version: '1.0.0', dependencies: {} })
  );

  findRoot.mockResolvedValue(tmpDir);

  // npm outdated: exit code 1 with stdout JSON is the "has outdated" path.
  execSyncMock.mockImplementation(((cmd: string) => {
    if (cmd.startsWith('npm outdated')) {
      const err = new Error('outdated') as Error & { stdout: string };
      err.stdout = JSON.stringify({
        react: { current: '18.0.0', wanted: '18.2.0', latest: '18.3.1' },
      });
      throw err;
    }
    if (cmd.startsWith('npm audit')) {
      return JSON.stringify({
        metadata: { vulnerabilities: { high: 2, moderate: 1, total: 3 } },
      });
    }
    return '';
  }) as never);
});

afterEach(() => {
  fsReal.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** All logged console output joined. */
function logged(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

describe('analyze — command', () => {
  describe('monorepo detection', () => {
    it('throws when not in a monorepo (human mode)', async () => {
      findRoot.mockResolvedValueOnce(null);
      await expect(runProjectAnalysis()).rejects.toThrow('Not in a Re-Shell monorepo');
    });

    it('emits NOT_IN_MONOREPO json error in json mode', async () => {
      findRoot.mockResolvedValueOnce(null);
      await runProjectAnalysis({ json: true });
      expect(jsonError).toHaveBeenCalledWith(
        'NOT_IN_MONOREPO',
        expect.stringContaining('Not in a Re-Shell monorepo')
      );
    });
  });

  describe('workspace discovery', () => {
    it('uses the --workspace filter when provided', async () => {
      await runProjectAnalysis({ workspace: 'apps/shell' });
      const payload = vi.mocked(jsonSuccess).mock.calls.length
        ? undefined
        : logged();
      // Human render lists only the filtered workspace.
      expect(payload).toContain('📦 apps/shell');
      expect(payload).not.toContain('📦 packages/ui-kit');
    });

    it('skips workspaces without package.json', async () => {
      // The declared glob apps/* matches apps/shell only here; add a stray
      // directory without package.json that the scan fallback would skip.
      fsReal.mkdirSync(path.join(tmpDir, 'apps', 'empty'), { recursive: true });
      await runProjectAnalysis({ workspace: 'apps/shell' });
      expect(logged()).not.toContain('📦 apps/empty');
    });

    it('falls back to scanning directories when workspaces is absent', async () => {
      fsReal.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'scan-root', private: true })
      );
      // getWorkspaces scans depth<=2: apps/shell + packages/ui-kit found.
      await runProjectAnalysis({});
      const out = logged();
      expect(out).toContain('📦 apps/shell');
      expect(out).toContain('📦 packages/ui-kit');
    });
  });

  describe('bundle analysis', () => {
    it('aggregates dist asset sizes and chunk stats', async () => {
      await runProjectAnalysis({ workspace: 'apps/shell', type: 'bundle' });
      const out = logged();
      expect(out).toContain('Bundle Analysis:');
      expect(out).toContain('Total size: 2.5 KB');
      expect(out).toContain('Assets: 2');
      expect(out).toContain('Chunks: 1');
    });

    it('reports N/A for a workspace without a build script', async () => {
      await runProjectAnalysis({ workspace: 'packages/ui-kit', type: 'bundle' });
      const out = logged();
      expect(out).toContain('Bundle Analysis:');
      expect(out).toContain('Total size: N/A');
      expect(out).toContain('Assets: 0');
    });

    it('attempts a build when no dist output exists', async () => {
      fsReal.rmSync(path.join(tmpDir, 'apps', 'shell', 'dist'), { recursive: true });
      await runProjectAnalysis({ workspace: 'apps/shell', type: 'bundle' });
      expect(execSyncMock).toHaveBeenCalledWith('npm run build', expect.anything());
      // Build mocked to succeed with '' — analyzeBuildAssets over a missing
      // dir returns [] so total renders 0 Bytes.
      expect(logged()).toContain('Total size: 0 Bytes');
    });

    it('reports Build failed when the attempted build throws', async () => {
      fsReal.rmSync(path.join(tmpDir, 'apps', 'shell', 'dist'), { recursive: true });
      execSyncMock.mockImplementation(((cmd: string) => {
        if (cmd === 'npm run build') throw new Error('build boom');
        return '';
      }) as never);
      await runProjectAnalysis({ workspace: 'apps/shell', type: 'bundle' });
      expect(logged()).toContain('Total size: Build failed');
    });
  });

  describe('dependency analysis', () => {
    it('counts production and development dependencies', async () => {
      await runProjectAnalysis({ workspace: 'apps/shell', type: 'dependencies' });
      const out = logged();
      expect(out).toContain('Dependencies:');
      expect(out).toContain('Total: 2');
      expect(out).toContain('Outdated: 1');
      expect(out).toContain('Vulnerabilities: 3');
    });

    it('renders zero-state output when npm outdated and audit fail silently', async () => {
      execSyncMock.mockImplementation((() => {
        throw new Error('no network');
      }) as never);
      await runProjectAnalysis({ workspace: 'apps/shell', type: 'dependencies' });
      const out = logged();
      expect(out).toContain('Total: 2');
      expect(out).toContain('Outdated: 0');
      expect(out).toContain('Vulnerabilities: 0');
    });
  });

  describe('performance analysis', () => {
    it('measures build time and dist size, and lists suggestions', async () => {
      await runProjectAnalysis({ workspace: 'apps/shell', type: 'performance' });
      const out = logged();
      expect(out).toContain('Performance:');
      // The render guard is `buildTime > 0`, and a mocked-instant build
      // measures 0ms — which renders as N/A.
      expect(out).toContain('Build time: N/A');
      expect(out).toContain('Bundle size: 2.5 KB');
      expect(out).toContain('Suggestions: 0');
    });

    it('reports N/A build time when the build fails', async () => {
      execSyncMock.mockImplementation(((cmd: string) => {
        if (cmd === 'npm run build') throw new Error('build boom');
        return '';
      }) as never);
      await runProjectAnalysis({ workspace: 'apps/shell', type: 'performance' });
      expect(logged()).toContain('Build time: N/A');
    });

    it('suggests faster build tools for slow builds', async () => {
      // 35s build — exceeds the 30s threshold. analyzePerformance calls
      // Date.now() twice around the build; a step counter makes the first
      // call the start time and every subsequent call start+35000.
      let calls = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        calls += 1;
        return 1_000_000 + (calls === 1 ? 0 : 35000);
      });
      await runProjectAnalysis({ workspace: 'apps/shell', type: 'performance' });
      expect(logged()).toContain('Suggestions: 1');
    });
  });

  describe('security analysis', () => {
    it('summarizes audit, sensitive files and recommendations', async () => {
      // Drop a sensitive file into the workspace.
      fsReal.writeFileSync(path.join(tmpDir, 'apps', 'shell', '.env'), 'KEY=1');
      await runProjectAnalysis({ workspace: 'apps/shell', type: 'security' });
      const out = logged();
      expect(out).toContain('Security:');
      expect(out).toContain('Sensitive files: 1');
      // gitignore rec + audit-fix rec + the two evergreen recs.
      expect(out).toContain('Recommendations: 4');
    });

    it('renders the zero-state security report when nothing is found', async () => {
      await runProjectAnalysis({ workspace: 'apps/shell', type: 'security' });
      const out = logged();
      expect(out).toContain('Sensitive files: 0');
      // Audit reports total:3 → "Run npm audit fix" + the two evergreen recs.
      expect(out).toContain('Recommendations: 3');
    });
  });

  describe('output modes', () => {
    it('emits the full payload through jsonSuccess in json mode', async () => {
      await runProjectAnalysis({ workspace: 'apps/shell', type: 'bundle', json: true });
      const payload = vi.mocked(jsonSuccess).mock.calls[0][0] as Record<string, unknown>;
      expect(payload.monorepo).toBe(path.basename(tmpDir));
      expect(payload.workspaces).toBe(1);
      const analysis = payload.analysis as Record<string, Record<string, unknown>>;
      expect(analysis['apps/shell'].bundle).toBeDefined();
    });

    it('saves the results to --output', async () => {
      const out = path.join(tmpDir, 'analysis.json');
      await runProjectAnalysis({ workspace: 'apps/shell', type: 'bundle', output: out });
      const saved = JSON.parse(fsReal.readFileSync(out, 'utf8'));
      expect(saved.workspaces).toBe(1);
      expect(logged()).toContain('Analysis results saved to');
    });

    it('wraps unexpected errors in ANALYZE_ERROR json', async () => {
      findRoot.mockRejectedValueOnce(new Error('disk error'));
      await runProjectAnalysis({ json: true });
      expect(jsonError).toHaveBeenCalledWith(
        'ANALYZE_ERROR',
        'disk error'
      );
    });

    it('fails the spinner and rethrows in human mode', async () => {
      findRoot.mockRejectedValueOnce(new Error('disk error'));
      const spinner = { setText: vi.fn(), fail: vi.fn(), stop: vi.fn() };
      await expect(runProjectAnalysis({ spinner: spinner as never })).rejects.toThrow(
        'disk error'
      );
      expect(spinner.fail).toHaveBeenCalled();
    });
  });
});
