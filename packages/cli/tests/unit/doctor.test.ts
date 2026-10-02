import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { runDoctorCheck } from '../../src/commands/doctor';

// Covers src/commands/doctor.ts — the `doctor` command (872 lines): an
// 8-check health battery (package.json structure, dependency duplicates,
// outdated deps, security audit, workspace config, git config, build
// config, performance/large files, filesystem/broken symlinks) plus a
// --fix remediation plan built on the real doctor-remediation rules.
//
// The monorepo tree is REAL on disk (findMonorepoRoot runs for real); only
// child_process.execSync and the JSON envelope helper are mocked.

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('../../src/utils/json-output', () => ({
  jsonSuccess: vi.fn(),
  enableJsonMode: () => () => {},
}));

const { execSync } = await import('child_process');
const execMock = vi.mocked(execSync);

let tempRoot: string;
let logs: string[];

function output(): string {
  return logs.join('\n');
}

function writeRootPackageJson(extra: Record<string, unknown> = {}): void {
  fs.writeFileSync(
    path.join(tempRoot, 'package.json'),
    JSON.stringify(
      {
        name: 'test-monorepo',
        private: true,
        workspaces: ['apps/*', 'packages/*'],
        engines: { node: '>=18' },
        ...extra,
      },
      null,
      2
    )
  );
}

function writeWorkspace(rel: string, pkg: Record<string, unknown>): void {
  const dir = path.join(tempRoot, rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
}

/** execSync mock that routes git status to '' and everything else to throw-with-stdout. */
function routeExec(routes: Record<string, { stdout?: string; throwWith?: string; ret?: string }>): void {
  execMock.mockImplementation(((cmd: string) => {
    for (const key of Object.keys(routes)) {
      if (cmd.includes(key)) {
        const route = routes[key];
        if (route.ret !== undefined) return route.ret;
        if (route.throwWith !== undefined) {
          const err = new Error('command failed') as Error & { stdout?: string };
          err.stdout = route.stdout ?? '';
          throw err;
        }
        return route.stdout ?? '';
      }
    }
    return '';
  }) as unknown as typeof execSync);
}

beforeEach(() => {
  vi.clearAllMocks();
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-doctor-'));
  logs = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  });
  // Doctor resolves the monorepo from process.cwd(); point it at the temp tree
  // so it does not detect the CLI package's own (real) monorepo instead.
  vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);

  writeRootPackageJson();
  fs.mkdirSync(path.join(tempRoot, 'apps'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'packages'), { recursive: true });
  writeWorkspace('apps/web', {
    name: '@test/web',
    version: '1.0.0',
    scripts: { build: 'vite build', dev: 'vite' },
    dependencies: { react: '^18.2.0' },
  });
  fs.writeFileSync(path.join(tempRoot, 'apps/web/vite.config.ts'), 'export default {}\n');
  writeWorkspace('packages/ui-kit', {
    name: '@test/ui-kit',
    version: '1.0.0',
    scripts: { build: 'tsc -p .' },
    devDependencies: { typescript: '^5.0.0' },
  });
  fs.writeFileSync(path.join(tempRoot, 'packages/ui-kit/vite.config.ts'), 'export default {}\n');

  // Healthy git state by default: repo + clean status.
  fs.mkdirSync(path.join(tempRoot, '.git'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, '.gitignore'), 'node_modules\n');
  routeExec({ 'git status': { ret: '' } });
  // Healthy outdated/audit by default: succeed silently.
  routeExec({
    'git status': { ret: '' },
    outdated: { ret: '' },
    audit: { ret: '' },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('doctor — command', () => {
  describe('monorepo detection', () => {
    it('reports a single error check when not inside a monorepo', async () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-empty-'));
      vi.mocked(process.cwd).mockReturnValue(emptyDir);
      try {
        await runDoctorCheck();
        expect(output()).toContain('Not in a monorepo workspace');
        expect(output()).toContain('monorepo-detection');
      } finally {
        vi.mocked(process.cwd).mockReturnValue(tempRoot);
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });
  });

  describe('full battery on a healthy monorepo', () => {
    it('runs all 8 check groups and reports them all as success', async () => {
      await runDoctorCheck();

      const { jsonSuccess } = await import('../../src/utils/json-output');
      expect(jsonSuccess).not.toHaveBeenCalled();
      expect(output()).toContain('Re-Shell Health Check Results');

      const names = [
        'package-json',
        'dependency-duplicates',
        'outdated-dependencies',
        'security-audit',
        'workspace-config',
        'git-config',
        'build-config',
        'large-files',
        'broken-symlinks',
      ];
      for (const name of names) {
        expect(output()).toContain(name);
      }
      expect(output()).toContain('2 properly configured workspaces');
    });

    it('prints the summary counts and overall health verdict', async () => {
      await runDoctorCheck();
      expect(output()).toMatch(/Summary:/);
      expect(output()).toMatch(/\d+ checks passed/);
      expect(output()).toContain('Overall Health:');
      expect(output()).toMatch(/Excellent|Good|Needs Attention/);
    });
  });

  describe('package-json check', () => {
    it('warns about missing engines and name together', async () => {
      writeRootPackageJson({ name: undefined, engines: undefined } as Record<string, unknown>);
      // Remove the fields the spread could not overwrite with undefined.
      const pkgPath = path.join(tempRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      delete pkg.name;
      delete pkg.engines;
      // Keep workspaces valid; private stays true so only the deleted fields trip.
      fs.writeFileSync(pkgPath, JSON.stringify(pkg));

      await runDoctorCheck();
      expect(output()).toContain('Missing package name');
      expect(output()).toContain('Missing engines specification');
      expect(output()).toContain('Package.json issues:');
    });

    it('stays healthy when a globbed directory has no package.json (detection quirk)', async () => {
      // QUIRK: the check's own catch ('Failed to check package.json') is
      // unreachable via file content — monorepo detection JSON.parses the same
      // file first and bails to 'Not in a monorepo workspace' before the check
      // runs. What IS reachable: a globbed sibling without package.json gets
      // filtered out by getWorkspaces and the root check stays green.
      fs.mkdirSync(path.join(tempRoot, 'apps/web2'), { recursive: true });
      fs.writeFileSync(path.join(tempRoot, 'apps/web2/.keep'), '');
      await runDoctorCheck();
      expect(output()).toContain('Package.json structure is valid');
      expect(output()).toContain('2 properly configured workspaces');
    });
  });

  describe('dependency-duplicates check', () => {
    it('warns when two workspaces pin different versions of a dependency', async () => {
      writeWorkspace('packages/other', {
        name: '@test/other',
        devDependencies: { typescript: '^4.9.0' }, // conflicts with ui-kit's ^5.0.0
      });
      await runDoctorCheck();
      expect(output()).toContain('dependency-duplicates');
      expect(output()).toContain('1 dependencies with version conflicts');
    });
  });

  describe('outdated-dependencies check', () => {
    it('counts outdated packages from the audit JSON stdout', async () => {
      routeExec({
        'git status': { ret: '' },
        outdated: {
          throwWith: 'exit 1',
          stdout: JSON.stringify({ react: { current: '18.0.0', wanted: '18.2.0' } }),
        },
      });
      await runDoctorCheck();
      expect(output()).toContain('Found 1 outdated dependencies');
    });

    it('falls back to a generic warning when the stdout is not JSON', async () => {
      routeExec({
        'git status': { ret: '' },
        outdated: { throwWith: 'exit 1', stdout: 'not json at all' },
      });
      await runDoctorCheck();
      expect(output()).toContain('Some dependencies may be outdated');
    });

    it('emits no outdated check when the command produces no stdout', async () => {
      routeExec({
        'git status': { ret: '' },
        outdated: { throwWith: 'exit 1', stdout: '' },
      });
      await runDoctorCheck();
      expect(output()).not.toContain('outdated-dependencies');
    });
  });

  describe('security-audit check', () => {
    it('errors with the vulnerability count and fix suggestion from audit JSON', async () => {
      routeExec({
        'git status': { ret: '' },
        outdated: { ret: '' },
        audit: {
          throwWith: 'exit 1',
          stdout: JSON.stringify({ metadata: { vulnerabilities: { total: 3 } } }),
        },
      });
      await runDoctorCheck({ verbose: true });
      expect(output()).toContain('Found 3 security vulnerabilities');
      expect(output()).toContain('audit fix');
    });

    it('falls back to a generic warning when audit stdout is not JSON', async () => {
      routeExec({
        'git status': { ret: '' },
        outdated: { ret: '' },
        audit: { throwWith: 'exit 1', stdout: 'garbage' },
      });
      await runDoctorCheck();
      expect(output()).toContain('Security audit completed with warnings');
    });
  });

  describe('package-manager detection', () => {
    it('uses pnpm outdated/audit commands when pnpm-lock.yaml exists', async () => {
      fs.writeFileSync(path.join(tempRoot, 'pnpm-lock.yaml'), '');
      await runDoctorCheck();
      const cmds = execMock.mock.calls.map(c => String(c[0]));
      expect(cmds).toContain('pnpm outdated --format json');
      expect(cmds).toContain('pnpm audit --json');
      expect(cmds).not.toContain('npm outdated --json');
    });
  });

  describe('workspace-config check', () => {
    it('warns when no workspaces are configured', async () => {
      const pkgPath = path.join(tempRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkg.workspaces = [];
      fs.writeFileSync(pkgPath, JSON.stringify(pkg));
      await runDoctorCheck();
      expect(output()).toContain('No workspaces found');
    });

    it('warns when a listed workspace is missing its package.json', async () => {
      // apps/* glob only matches apps/web; remove the ui-kit workspace entry by
      // pointing packages/* at an empty dir instead.
      fs.rmSync(path.join(tempRoot, 'packages/ui-kit'), { recursive: true, force: true });
      fs.mkdirSync(path.join(tempRoot, 'packages/ghost'), { recursive: true });
      await runDoctorCheck();
      // packages/ghost has no package.json → glob filter drops it → workspaces = [apps/web]
      // and the workspace-config check itself only sees valid entries.
      expect(output()).toContain('1 properly configured workspaces');
    });
  });

  describe('git-config check', () => {
    it('warns when the repository has no .git and no .gitignore', async () => {
      fs.rmSync(path.join(tempRoot, '.git'), { recursive: true, force: true });
      fs.rmSync(path.join(tempRoot, '.gitignore'), { force: true });
      await runDoctorCheck();
      expect(output()).toContain('Git repository not initialized');
    });

    it('warns about uncommitted changes reported by git status', async () => {
      routeExec({
        'git status': { ret: ' M apps/web/package.json\n' },
        outdated: { ret: '' },
        audit: { ret: '' },
      });
      await runDoctorCheck();
      expect(output()).toContain('uncommitted changes');
    });
  });

  describe('build-config check', () => {
    it('warns when buildable workspaces lack build configuration files', async () => {
      fs.rmSync(path.join(tempRoot, 'apps/web/vite.config.ts'), { force: true });
      await runDoctorCheck();
      expect(output()).toContain('1 workspaces missing build configuration files');
    });
  });

  describe('large-files check', () => {
    it('flags files larger than 10MB with their names', async () => {
      const big = Buffer.alloc(11 * 1024 * 1024);
      fs.writeFileSync(path.join(tempRoot, 'apps/web/huge-asset.bin'), big);
      await runDoctorCheck();
      expect(output()).toContain('Found 1 large files');
      expect(output()).toContain('huge-asset.bin');
    });
  });

  describe('--explain', () => {
    it('appends cause/fix/run lines for failing checks in human mode', async () => {
      fs.rmSync(path.join(tempRoot, '.git'), { recursive: true, force: true });
      await runDoctorCheck({ explain: true });
      expect(output()).toContain('Explanations & Suggested Fixes');
      expect(output()).toContain('Cause:');
      expect(output()).toContain('Fix:');
    });

    it('includes suggestions in the JSON payload when --explain is set', async () => {
      fs.rmSync(path.join(tempRoot, '.git'), { recursive: true, force: true });
      await runDoctorCheck({ explain: true, json: true });
      const { jsonSuccess } = await import('../../src/utils/json-output');
      expect(jsonSuccess).toHaveBeenCalledTimes(1);
      const [payload] = vi.mocked(jsonSuccess).mock.calls[0];
      expect(payload).toHaveProperty('checks');
      expect(payload).toHaveProperty('suggestions');
      expect((payload as { suggestions: unknown[] }).suggestions.length).toBeGreaterThan(0);
    });

    it('omits suggestions from the JSON payload without --explain', async () => {
      await runDoctorCheck({ json: true });
      const { jsonSuccess } = await import('../../src/utils/json-output');
      expect(jsonSuccess).toHaveBeenCalledTimes(1);
      const [payload] = vi.mocked(jsonSuccess).mock.calls[0];
      expect(payload).toHaveProperty('checks');
      expect(payload).not.toHaveProperty('suggestions');
    });
  });

  describe('--fix', () => {
    it('prints a dry-run plan without executing any fix commands', async () => {
      routeExec({
        'git status': { ret: ' M apps/web/package.json\n' },
        outdated: { ret: '' },
        audit: {
          throwWith: 'exit 1',
          stdout: JSON.stringify({ metadata: { vulnerabilities: { total: 2 } } }),
        },
      });
      await runDoctorCheck({ fix: true });

      expect(output()).toContain('Fix Plan');
      expect(output()).toContain('Dry run: nothing was changed');
      // No audit-fix command was run (only the audit itself ran).
      const cmds = execMock.mock.calls.map(c => String(c[0]));
      expect(cmds).not.toContain('npm audit fix');
      expect(output()).toContain('[would run]');
    });

    it('applies allow-listed commands with --yes', async () => {
      routeExec({
        'git status': { ret: ' M apps/web/package.json\n' },
        outdated: { ret: '' },
        audit: {
          throwWith: 'exit 1',
          stdout: JSON.stringify({ metadata: { vulnerabilities: { total: 2 } } }),
        },
      });
      await runDoctorCheck({ fix: true, yes: true });

      const cmds = execMock.mock.calls.map(c => String(c[0]));
      expect(cmds).toContain('npm audit fix');
      expect(output()).toContain('[applied]');
    });

    it('emits the plan through jsonSuccess in json mode', async () => {
      routeExec({
        'git status': { ret: ' M apps/web/package.json\n' },
        outdated: { ret: '' },
        audit: {
          throwWith: 'exit 1',
          stdout: JSON.stringify({ metadata: { vulnerabilities: { total: 2 } } }),
        },
      });
      await runDoctorCheck({ fix: true, json: true });
      const { jsonSuccess } = await import('../../src/utils/json-output');
      expect(jsonSuccess).toHaveBeenCalledTimes(1);
      const [payload] = vi.mocked(jsonSuccess).mock.calls[0];
      expect(payload).toHaveProperty('plan');
      expect(payload).toHaveProperty('suggestions');
    });

    it('reports no remediable issues on a healthy monorepo', async () => {
      await runDoctorCheck({ fix: true });
      expect(output()).toContain('No remediable issues found');
    });
  });

  describe('doctor-execution error wrapper', () => {
    it('surfaces findMonorepoRoot rejections as an error check', async () => {
      const monorepo = await import('../../src/utils/monorepo');
      const spy = vi.spyOn(monorepo, 'findMonorepoRoot').mockRejectedValueOnce(new Error('boom'));
      try {
        await runDoctorCheck();
        expect(output()).toContain('Doctor check failed: boom');
        expect(output()).toContain('doctor-execution');
      } finally {
        spy.mockRestore();
      }
    });
  });
});
