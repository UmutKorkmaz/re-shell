import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import prompts from 'prompts';
import { createProject } from '../../src/commands/create';
import { findMonorepoRoot } from '../../src/utils/monorepo';
import { performProjectHealthCheck } from '../../src/utils/database';
import type { HealthCheckReport } from '../../src/utils/database';

// Covers src/commands/create.ts (~4300 lines) via its single exported entry
// point createProject: dry-run preview, polyglot + microfrontend interactive
// flows, in-monorepo workspace creation (frontend / backend / fullstack via
// architecture templates) and top-level standalone monorepo creation.
// The file tree operations run for real inside a temp cwd; prompts and the
// health check are mocked.

vi.mock('prompts', () => ({ default: vi.fn() }));

vi.mock('../../src/utils/monorepo', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/utils/monorepo')>();
  return {
    ...original,
    findMonorepoRoot: vi.fn(original.findMonorepoRoot),
  };
});

vi.mock('../../src/utils/database', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/utils/database')>();
  const healthy: HealthCheckReport = {
    overallStatus: 'healthy',
    checks: [],
    timestamp: '2026-01-01T00:00:00.000Z',
    projectPath: '/healthy',
  };
  return {
    ...original,
    performProjectHealthCheck: vi.fn(async () => healthy),
  };
});

const fse = fs as typeof fs & {
  ensureDir: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
  chmod: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

let tempRoot: string;
let logSpy: ReturnType<typeof vi.spyOn>;
const promptsMock = vi.mocked(prompts);
const healthMock = vi.mocked(performProjectHealthCheck);
const monorepoMock = vi.mocked(findMonorepoRoot);

function output(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

/** Stage a monorepo root (cwd) the way findMonorepoRoot detects one. */
function stageMonorepoRoot(): void {
  fs.writeJsonSync(path.join(tempRoot, 'package.json'), {
    name: 'host-mono',
    private: true,
    workspaces: ['apps/*', 'packages/*'],
  });
  fs.ensureDirSync(path.join(tempRoot, 'apps', 'shell'));
  fs.writeJsonSync(path.join(tempRoot, 'apps', 'shell', 'package.json'), {
    name: '@host/shell',
    version: '0.0.1',
  });
}

describe('create — command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-create-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
    // Default: standalone invocation (no enclosing monorepo).
    monorepoMock.mockResolvedValue(null);
    // Default: prompts resolve to an empty answer bag. createWorkspace always
    // awaits prompts(...) (even with an empty config array) and then reads
    // responses.useTemplate — undefined would crash it.
    promptsMock.mockReset().mockResolvedValue({});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.remove(tempRoot);
  });

  describe('createProject dispatch', () => {
    it('rejects names containing path separators', async () => {
      await expect(
        createProject('evil/../name', { dryRun: true })
      ).rejects.toThrow('must not contain path separators');
    });

    it('rejects names containing backslash traversal', async () => {
      await expect(
        createProject('evil\\..\\name', { dryRun: true })
      ).rejects.toThrow('must not contain path separators');
    });

    it('prints a preview and writes nothing with --dry-run', async () => {
      await createProject('My Preview App', { dryRun: true, verbose: true });

      expect(output()).toContain('Dry Run Preview');
      expect(output()).toContain('No files will be created.');
      expect(output()).toContain('my-preview-app');
      expect(output()).toContain('Mode: frontend');
      const created = fs.readdirSync(tempRoot);
      expect(created).toEqual([]);
    });

    it('previews polyglot and microfrontend modes distinctly', async () => {
      await createProject('pg', { dryRun: true, polyglot: true });
      expect(output()).toContain('Mode: polyglot');
      logSpy.mockClear();

      await createProject('mf', { dryRun: true, microfrontend: true });
      expect(output()).toContain('Mode: microfrontend');
      logSpy.mockClear();

      await createProject('fs', { dryRun: true, fullstack: true });
      expect(output()).toContain('Mode: fullstack');
    });

    it('previews the workspace target dir when --type is given', async () => {
      await createProject('pkg', { dryRun: true, type: 'package', verbose: true });

      expect(output()).toContain('packages');
      expect(output()).toContain(`packages${path.sep}pkg`);
    });

    it('previews the services/ api folder for fullstack workspace targets', async () => {
      await createProject(
        'monofull',
        { dryRun: true, type: 'app', fullstack: true, verbose: true }
      );

      expect(output()).toContain(`services${path.sep}monofull-api`);
    });
  });

  describe('dry-run inside a monorepo', () => {
    it('routes the preview under the monorepo root', async () => {
      stageMonorepoRoot();
      monorepoMock.mockResolvedValue(tempRoot);

      await createProject('inner', { dryRun: true });

      expect(output()).toContain('Mode: frontend');
      expect(monorepoMock).toHaveBeenCalled();
    });
  });

  describe('standalone monorepo creation (createMonorepoProject)', () => {
    it('scaffolds the workspace skeleton with react-ts defaults non-interactively', async () => {
      await createProject('solo-app', { yes: true, framework: 'react-ts' });

      const pkg = fs.readJsonSync(path.join(tempRoot, 'solo-app', 'package.json'));
      expect(pkg.name).toBe('solo-app');
      expect(pkg.workspaces).toEqual(['apps/*', 'packages/*']);
      expect(pkg.scripts.dev).toContain('dev');
      for (const dir of ['apps', 'packages', 'docs']) {
        expect(fs.existsSync(path.join(tempRoot, 'solo-app', dir))).toBe(true);
      }
      expect(fs.existsSync(path.join(tempRoot, 'solo-app', 'README.md'))).toBe(true);
      expect(output()).toContain('created successfully');
    });

    it('writes pnpm-workspace.yaml only for pnpm', async () => {
      await createProject('pnpm-mono', {
        yes: true,
        framework: 'react-ts',
        packageManager: 'pnpm',
      });
      expect(
        fs.existsSync(path.join(tempRoot, 'pnpm-mono', 'pnpm-workspace.yaml'))
      ).toBe(true);

      logSpy.mockClear();
      await createProject('npm-mono', {
        yes: true,
        framework: 'react-ts',
        packageManager: 'npm',
      });
      expect(
        fs.existsSync(path.join(tempRoot, 'npm-mono', 'pnpm-workspace.yaml'))
      ).toBe(false);
    });

    it('refuses to overwrite an existing directory', async () => {
      fs.mkdirSync(path.join(tempRoot, 'dup'));
      await expect(
        createProject('dup', { yes: true, framework: 'react-ts' })
      ).rejects.toThrow('Directory already exists');
    });

    it('scaffolds a backend app from --backend', async () => {
      await createProject('api-only', {
        yes: true,
        backend: 'express',
      });

      const apiPath = path.join(tempRoot, 'api-only', 'apps', 'api-only');
      expect(fs.existsSync(path.join(apiPath, 'package.json'))).toBe(true);
      const pkg = fs.readJsonSync(path.join(apiPath, 'package.json'));
      expect(pkg.name).toBe('api-only');
      expect(output()).toContain('Scaffolded');
    });

    it('warns and skips an unknown backend id', async () => {
      await createProject('bad-api', { yes: true, backend: 'nope-js' });

      expect(output()).toContain('Unknown backend');
      // The monorepo skeleton is still created; only the backend app is skipped.
      expect(fs.existsSync(path.join(tempRoot, 'bad-api', 'apps'))).toBe(true);
      expect(
        fs.existsSync(path.join(tempRoot, 'bad-api', 'apps', 'bad-api'))
      ).toBe(false);
    });

    it('scaffolds both api and frontend for --fullstack', async () => {
      await createProject('full-app', {
        yes: true,
        backend: 'express',
        fullstack: true,
      });

      expect(
        fs.existsSync(path.join(tempRoot, 'full-app', 'apps', 'full-app-api'))
      ).toBe(true);
      const fePkg = fs.readJsonSync(
        path.join(tempRoot, 'full-app', 'apps', 'full-app', 'package.json')
      );
      expect(fePkg.name).toBe('full-app');
      expect(fePkg.dependencies.react).toBeDefined();
      expect(
        fs.existsSync(path.join(tempRoot, 'full-app', 'apps', 'full-app', 'src', 'main.tsx'))
      ).toBe(true);
    });
  });

  describe('workspace creation inside a monorepo (createWorkspace)', () => {
    beforeEach(() => {
      stageMonorepoRoot();
      monorepoMock.mockResolvedValue(tempRoot);
    });

    it('creates a react-ts frontend workspace under apps/', async () => {
      await createProject('feature-a', {
        framework: 'react-ts',
        packageManager: 'pnpm',
      });

      const wsPath = path.join(tempRoot, 'apps', 'feature-a');
      expect(fs.existsSync(wsPath)).toBe(true);
      expect(fs.existsSync(path.join(wsPath, 'package.json'))).toBe(true);
      expect(output()).toContain('feature-a');
      expect(output()).toContain('created successfully');
    });

    it('routes --type package/lib/tool to their directories', async () => {
      await createProject('lib-thing', { type: 'lib', framework: 'react-ts' });
      expect(
        fs.existsSync(path.join(tempRoot, 'libs', 'lib-thing', 'package.json'))
      ).toBe(true);

      logSpy.mockClear();
      await createProject('tool-thing', { type: 'tool', framework: 'react-ts' });
      expect(
        fs.existsSync(path.join(tempRoot, 'tools', 'tool-thing', 'package.json'))
      ).toBe(true);
    });

    it('applies language best practices and reports the health check', async () => {
      await createProject('healthy-app', { framework: 'react-ts' });

      expect(healthMock).toHaveBeenCalled();
      expect(output()).toContain('Project Health Check');
    });

    it('renders the health report when the check reports warnings', async () => {
      healthMock.mockResolvedValueOnce({
        ...({} as HealthCheckReport),
        overallStatus: 'warning',
        checks: [],
        timestamp: '',
        projectPath: '',
      });

      await createProject('warny-app', { framework: 'react-ts' });

      expect(output()).toContain('Minor issues detected');
    });

    it('cancels cleanly when the overwrite prompt is declined', async () => {
      fs.mkdirSync(path.join(tempRoot, 'apps', 'occupied'), { recursive: true });

      // Answer only the overwrite select; every other prompt gets {}.
      promptsMock.mockImplementation(async (asked: unknown) => {
        const opts = Array.isArray(asked) ? asked[0] : asked;
        const name = (opts as { name?: string })?.name;
        if (name === 'action') return { action: 'cancel' };
        return {};
      });

      await createProject('occupied', { framework: 'react-ts' });

      expect(output()).toContain('Operation cancelled');
      // The pre-existing directory is untouched
      expect(fs.readdirSync(path.join(tempRoot, 'apps', 'occupied'))).toEqual([]);
    });

    it('overwrites when the overwrite prompt is accepted', async () => {
      const occupied = path.join(tempRoot, 'apps', 'occupied');
      fs.mkdirSync(occupied, { recursive: true });
      fs.writeFileSync(path.join(occupied, 'stale.txt'), 'old');

      promptsMock.mockImplementation(async (asked: unknown) => {
        const opts = Array.isArray(asked) ? asked[0] : asked;
        const name = (opts as { name?: string })?.name;
        if (name === 'action') return { action: 'overwrite' };
        return {};
      });

      await createProject('occupied', { framework: 'react-ts' });

      expect(fs.existsSync(path.join(occupied, 'stale.txt'))).toBe(false);
      expect(fs.existsSync(path.join(occupied, 'package.json'))).toBe(true);
    });

    it('uses an architecture template end-to-end (mern)', async () => {
      await createProject('mern-app', { template: 'mern', packageManager: 'pnpm' });

      const wsPath = path.join(tempRoot, 'apps', 'mern-app');
      expect(fs.existsSync(wsPath)).toBe(true);
      expect(output()).toContain('Using architecture template');
      // mern = express backend + react frontend
      expect(output()).toMatch(/backend|full-stack/);
    });

    it('creates a backend-only workspace from --backend', async () => {
      await createProject('svc-api', { backend: 'express', packageManager: 'pnpm' });

      const wsPath = path.join(tempRoot, 'apps', 'svc-api');
      expect(fs.existsSync(path.join(wsPath, 'package.json'))).toBe(true);
      expect(output()).toContain('backend');
    });

    it('throws for an unknown backend template id', async () => {
      await expect(
        createProject('weird-api', { backend: 'does-not-exist' })
      ).rejects.toThrow('Unknown backend template');
    });

    it('normalizes names with spaces to kebab-case', async () => {
      await createProject('My Cool Feature', { framework: 'react-ts' });

      expect(
        fs.existsSync(path.join(tempRoot, 'apps', 'my-cool-feature'))
      ).toBe(true);
    });
  });

  describe('polyglot interactive flow', () => {
    it('runs the full wizard and scaffolds the project', async () => {
      // gateway, includeFrontend, frontend, database, then the service loop:
      // language, framework, serviceName, then (>=2 services) addMore:false,
      // finally confirm:true
      promptsMock
        .mockResolvedValueOnce({ gatewayFramework: 'express' })
        .mockResolvedValueOnce({ includeFrontend: true })
        .mockResolvedValueOnce({ frontend: 'react' })
        .mockResolvedValueOnce({ database: 'postgres' })
        .mockResolvedValueOnce({ language: 'typescript' })
        .mockResolvedValueOnce({ framework: 'express' })
        .mockResolvedValueOnce({ serviceName: 'node-svc' })
        .mockResolvedValueOnce({ language: 'python' })
        .mockResolvedValueOnce({ framework: 'fastapi' })
        .mockResolvedValueOnce({ serviceName: 'py-svc' })
        .mockResolvedValueOnce({ addMore: false })
        .mockResolvedValueOnce({ confirm: true });

      await createProject('poly-app', { polyglot: true, packageManager: 'pnpm' });

      expect(output()).toContain('Creating Polyglot Microservices Project');
      expect(output()).toContain('node-svc');
      expect(output()).toContain('py-svc');
      const projectPath = path.join(tempRoot, 'poly-app');
      expect(fs.existsSync(projectPath)).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'gateway', 'package.json'))).toBe(true);
      expect(output()).toContain('created successfully');
    });

    it('cancels when the final confirm is declined', async () => {
      // NOTE: the service loop only offers the exit prompt once two services
      // are queued, so even a cancelled run stages two services first.
      promptsMock
        .mockResolvedValueOnce({ gatewayFramework: 'express' })
        .mockResolvedValueOnce({ includeFrontend: false })
        .mockResolvedValueOnce({ database: 'postgres' })
        .mockResolvedValueOnce({ language: 'typescript' })
        .mockResolvedValueOnce({ framework: 'express' })
        .mockResolvedValueOnce({ serviceName: 'svc-one' })
        .mockResolvedValueOnce({ language: 'typescript' })
        .mockResolvedValueOnce({ framework: 'express' })
        .mockResolvedValueOnce({ serviceName: 'svc-two' })
        .mockResolvedValueOnce({ addMore: false })
        .mockResolvedValueOnce({ confirm: false });

      await createProject('poly-cancel', { polyglot: true });

      expect(output()).toContain('Project creation cancelled');
      expect(fs.existsSync(path.join(tempRoot, 'poly-cancel'))).toBe(false);
    });
  });

  describe('microfrontend interactive flow', () => {
    it('runs the wizard with one remote and scaffolds shell + remote', async () => {
      // shellFramework, useSharedDeps, then remote loop:
      // framework, remoteName, route, hasExposed, exposePath, addMore, confirm
      promptsMock
        .mockResolvedValueOnce({ shellFramework: 'react-ts' })
        .mockResolvedValueOnce({ useSharedDeps: ['react', 'react-dom'] })
        .mockResolvedValueOnce({ framework: 'react' })
        .mockResolvedValueOnce({ remoteName: 'catalog' })
        .mockResolvedValueOnce({ route: '/catalog' })
        .mockResolvedValueOnce({ hasExposed: true })
        .mockResolvedValueOnce({ exposePath: './src/App' })
        .mockResolvedValueOnce({ addMore: false })
        .mockResolvedValueOnce({ confirm: true });

      await createProject('mf-app', { microfrontend: true, packageManager: 'pnpm' });

      expect(output()).toContain('Creating Microfrontend Project');
      expect(output()).toContain('catalog');
      expect(output()).toContain('http://localhost:3001');
      const projectPath = path.join(tempRoot, 'mf-app');
      expect(fs.existsSync(path.join(projectPath, 'shell', 'package.json'))).toBe(true);
      expect(
        fs.existsSync(path.join(projectPath, 'remotes', 'catalog', 'package.json'))
      ).toBe(true);
    });

    it('creates a remote with no exposed modules when hasExposed is declined', async () => {
      promptsMock
        .mockResolvedValueOnce({ shellFramework: 'react-ts' })
        .mockResolvedValueOnce({ useSharedDeps: ['react'] })
        .mockResolvedValueOnce({ framework: 'react' })
        .mockResolvedValueOnce({ remoteName: 'ghost' })
        .mockResolvedValueOnce({ route: '/ghost' })
        .mockResolvedValueOnce({ hasExposed: false })
        .mockResolvedValueOnce({ addMore: false })
        .mockResolvedValueOnce({ confirm: true });

      await createProject('ghost-app', { microfrontend: true });

      // hasExposed:false leaves `exposes` empty; the remote is still scaffolded.
      // ('No remotes added' is unreachable: every remote is pushed before the
      // loop's exit prompt fires.)
      expect(
        fs.existsSync(path.join(tempRoot, 'ghost-app', 'remotes', 'ghost', 'package.json'))
      ).toBe(true);
      expect(
        fs.existsSync(path.join(tempRoot, 'ghost-app', 'shell', 'package.json'))
      ).toBe(true);
    });
  });
});
