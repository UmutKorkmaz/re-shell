import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  listWorkspaces,
  updateWorkspaces,
  generateWorkspaceGraph,
  buildWorkspaceSummary,
  buildConfigHealth,
  produceWorkspaceSummary,
  initWorkspace,
  validateWorkspaceConfig,
  checkWorkspaceHealth,
  migrateWorkspace,
  optimizeWorkspace,
} from '../../src/commands/workspace';
import * as jsonOutput from '../../src/utils/json-output';
import * as monorepoUtil from '../../src/utils/monorepo';

// Covers src/commands/workspace.ts — the `workspace` command group
// (3208 lines): list/update/graph/summary/init/validate/health/migrate/
// optimize. Everything runs against a REAL staged monorepo with REAL
// workspace package.json files and REAL re-shell.workspaces.yaml configs;
// child_process exec/execSync are mocked so no package manager runs.

const execMock = vi.hoisted(() => vi.fn());
const execSyncMock = vi.hoisted(() => vi.fn());

vi.mock('child_process', async (importOriginal) => {
  const real = await importOriginal<typeof import('child_process')>();
  return {
    ...real,
    exec: Object.assign(execMock, { __promisified__: true }),
    execSync: execSyncMock,
  };
});

vi.mock('prompts', () => ({ default: vi.fn() }));
vi.mock('../../src/utils/json-output', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/utils/json-output')>();
  return {
    ...real,
    jsonSuccess: vi.fn(real.jsonSuccess),
    jsonError: vi.fn(real.jsonError),
    ok: vi.fn(real.ok),
    fail: vi.fn(real.fail),
  };
});

import prompts from 'prompts';

let tempRoot: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let cwdSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

function output(): string {
  return logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
}

function stderr(): string {
  return errSpy.mock.calls.map((c) => c.join(' ')).join('\n');
}

/**
 * Stage a real monorepo:
 *   root package.json + pnpm-lock.yaml
 *   apps/web        (app, react, depends on packages/ui-kit)
 *   apps/api        (app, express)
 *   packages/ui-kit (package)
 */
async function stageMonorepo(): Promise<void> {
  await fs.ensureDir(tempRoot);
  await fs.writeJson(path.join(tempRoot, 'package.json'), {
    name: 'test-monorepo',
    private: true,
    workspaces: ['apps/*', 'packages/*'],
  });
  await fs.writeFile(path.join(tempRoot, 'pnpm-lock.yaml'), '');

  await fs.outputJson(path.join(tempRoot, 'apps', 'web', 'package.json'), {
    name: '@test/web',
    version: '1.0.0',
    dependencies: { react: '^18.0.0', '@test/ui-kit': 'workspace:*' },
  });
  await fs.outputJson(path.join(tempRoot, 'apps', 'api', 'package.json'), {
    name: '@test/api',
    version: '1.0.0',
    dependencies: { express: '^4.0.0' },
  });
  await fs.outputJson(path.join(tempRoot, 'packages', 'ui-kit', 'package.json'), {
    name: '@test/ui-kit',
    version: '2.1.0',
    devDependencies: { typescript: '^5.0.0' },
  });
}

async function writeWorkspaceConfig(
  content: string,
  file: string = 're-shell.workspaces.yaml'
): Promise<string> {
  const configPath = path.join(tempRoot, file);
  await fs.writeFile(configPath, content);
  return configPath;
}

const VALID_CONFIG = `name: test-workspace
version: "2.0.0"
services:
  web:
    name: web
    type: frontend
    language: typescript
    framework: react
    path: apps/web
  api:
    name: api
    type: backend
    language: typescript
    framework: express
    path: apps/api
    dependsOn:
      - web
`;

beforeEach(async () => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-workspace-cmd-'));
  await stageMonorepo();

  cwdSpy = vi.spyOn(process, 'cwd');
  cwdSpy.mockReturnValue(tempRoot);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  execMock.mockReset();
  execSyncMock.mockReset();
  vi.mocked(prompts).mockReset();
  vi.clearAllMocks();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  process.removeAllListeners('SIGINT');
  await fs.remove(tempRoot);
});

describe('workspace — command', () => {
  describe('listWorkspaces', () => {
    it('lists discovered workspaces grouped by type', async () => {
      await listWorkspaces();

      const text = output();
      expect(text).toContain('📦 Workspaces');
      expect(text).toContain('APPS:');
      expect(text).toContain('PACKAGES:');
      expect(text).toContain('@test/web [react]');
      expect(text).toContain('@test/ui-kit');
      expect(text).toContain('Total: 3 workspaces');
    });

    it('filters by type', async () => {
      await listWorkspaces({ type: 'app' });

      expect(output()).toContain('@test/web');
      expect(output()).not.toContain('@test/ui-kit');
      expect(output()).toContain('Total: 2 workspaces');
    });

    it('filters by framework', async () => {
      await listWorkspaces({ framework: 'react' });

      expect(output()).toContain('@test/web');
      expect(output()).not.toContain('@test/api');
    });

    it('reports empty results', async () => {
      await listWorkspaces({ type: 'tool' });

      expect(output()).toContain('No workspaces found.');
    });

    it('emits a JSON envelope with the workspace list', async () => {
      await listWorkspaces({ json: true });

      const payload = vi.mocked(jsonOutput.jsonSuccess).mock.calls[0][0];
      expect(payload).toHaveLength(3);
      expect(payload.map((w: { name: string }) => w.name)).toContain('@test/web');
    });

    it('emits a NOT_IN_MONOREPO error envelope outside a monorepo', async () => {
      await fs.remove(path.join(tempRoot, 'package.json'));

      await listWorkspaces({ json: true });

      expect(vi.mocked(jsonOutput.jsonError).mock.calls[0][0]).toBe('NOT_IN_MONOREPO');
    });

    it('throws outside a monorepo in human mode', async () => {
      await fs.remove(path.join(tempRoot, 'package.json'));

      await expect(listWorkspaces()).rejects.toThrow(/Not in a monorepo/);
    });
  });

  describe('updateWorkspaces', () => {
    it('throws outside a monorepo', async () => {
      await fs.remove(path.join(tempRoot, 'package.json'));

      await expect(updateWorkspaces({})).rejects.toThrow(/Not in a monorepo/);
    });

    it('throws for an unknown workspace name', async () => {
      await expect(updateWorkspaces({ workspace: 'nope' })).rejects.toThrow(
        /Workspace "nope" not found/
      );
    });

    it('runs a pnpm update in every workspace by default', async () => {
      execMock.mockImplementation(((
        _cmd: string,
        opts: { cwd?: string },
        cb: (e: Error | null) => void
      ) => {
        expect(opts?.cwd).toBeTruthy();
        cb(null as never);
      }) as never);

      await updateWorkspaces({});

      // exec is promisified by the command — 3 workspaces, 3 calls.
      expect(execMock).toHaveBeenCalledTimes(3);
    });

    it('updates one workspace matched by name with the pnpm add command', async () => {
      execMock.mockImplementation(((
        _cmd: string,
        _opts: unknown,
        cb: (e: Error | null) => void
      ) => cb(null as never)) as never);

      await updateWorkspaces({
        workspace: '@test/web',
        dependency: 'react',
        version: '19.0.0',
      });

      expect(execMock).toHaveBeenCalledTimes(1);
      const call = execMock.mock.calls[0] as unknown as string[];
      expect(String(call[0])).toContain('pnpm add --save react@19.0.0');
      expect((call[1] as { cwd: string }).cwd).toBe(path.join(tempRoot, 'apps', 'web'));
    });

    it('uses --save-dev when dev is set', async () => {
      execMock.mockImplementation(((
        _c: string,
        _o: unknown,
        cb: (e: Error | null) => void
      ) => cb(null as never)) as never);

      await updateWorkspaces({
        workspace: '@test/web',
        dependency: 'jest',
        version: '30.0.0',
        dev: true,
      });

      expect(String(execMock.mock.calls[0][0])).toContain('--save-dev');
    });

    it('resolves a workspace by path fragment', async () => {
      execMock.mockImplementation(((
        _c: string,
        _o: unknown,
        cb: (e: Error | null) => void
      ) => cb(null as never)) as never);

      await updateWorkspaces({ workspace: 'ui-kit', dependency: 'react', version: '18.3.0' });

      expect((execMock.mock.calls[0][1] as { cwd: string }).cwd).toBe(
        path.join(tempRoot, 'packages', 'ui-kit')
      );
    });

    it('falls back to npm when no lockfile marks pnpm/yarn', async () => {
      await fs.remove(path.join(tempRoot, 'pnpm-lock.yaml'));
      execMock.mockImplementation(((
        _c: string,
        _o: unknown,
        cb: (e: Error | null) => void
      ) => cb(null as never)) as never);

      await updateWorkspaces({ workspace: '@test/web', dependency: 'react', version: '18.3.0' });

      expect(String(execMock.mock.calls[0][0])).toContain('npm install --save react@18.3.0');
    });
  });

  describe('generateWorkspaceGraph', () => {
    it('renders a text graph with dependencies and dependents', async () => {
      await generateWorkspaceGraph({});

      const text = output();
      expect(text).toContain('🔗 Workspace Dependency Graph');
      expect(text).toContain('@test/web (app)');
      expect(text).toContain('Dependencies:');
      expect(text).toContain('@test/ui-kit');
      expect(text).toContain('Dependents:');
    });

    it('emits the contract graph via ok() for json format', async () => {
      await generateWorkspaceGraph({ format: 'json' });

      const payload = vi.mocked(jsonOutput.ok).mock.calls[0][0];
      expect(payload.apps.map((a: { name: string }) => a.name)).toContain('@test/web');
      expect(payload.services.map((s: { name: string }) => s.name)).toContain('@test/ui-kit');
      // Internal dependency edges are projected onto the node.
      const web = payload.apps.find((a: { name: string }) => a.name === '@test/web');
      expect(web.dependencies).toContain('@test/ui-kit');
    });

    it('writes the rich graph to a file with --output for json format', async () => {
      const outPath = path.join(tempRoot, 'graph.json');
      await generateWorkspaceGraph({ format: 'json', output: outPath });

      const written = await fs.readJson(outPath);
      expect(written.nodes.map((n: { id: string }) => n.id)).toContain('@test/web');
      expect(written.edges).toEqual([
        { from: '@test/web', to: '@test/ui-kit', type: 'dependency' },
      ]);
    });

    it('renders a mermaid graph', async () => {
      await generateWorkspaceGraph({ format: 'mermaid' });

      expect(output()).toContain('graph TD');
      expect(output()).toContain('-->');
    });

    it('writes a mermaid graph to --output', async () => {
      const outPath = path.join(tempRoot, 'graph.mmd');
      await generateWorkspaceGraph({ format: 'mermaid', output: outPath });

      const written = await fs.readFile(outPath, 'utf8');
      expect(written.startsWith('graph TD')).toBe(true);
      expect(output()).toContain('Mermaid graph saved');
    });

    it('renders an SVG graph', async () => {
      const outPath = path.join(tempRoot, 'graph.svg');
      await generateWorkspaceGraph({ format: 'svg', output: outPath });

      const written = await fs.readFile(outPath, 'utf8');
      expect(written).toContain('<svg');
      expect(output()).toContain('SVG graph saved');
    });

    it('renders a D3 graph', async () => {
      const outPath = path.join(tempRoot, 'graph.json.d3');
      await generateWorkspaceGraph({ format: 'd3', output: outPath });

      const written = await fs.readJson(outPath);
      expect(Array.isArray(written.nodes)).toBe(true);
      expect(output()).toContain('D3.js graph saved');
    });

    it('fails with a NOT_IN_MONOREPO envelope outside a monorepo (json)', async () => {
      await fs.remove(path.join(tempRoot, 'package.json'));

      await generateWorkspaceGraph({ format: 'json' });

      expect(vi.mocked(jsonOutput.fail).mock.calls[0][0]).toBe('NOT_IN_MONOREPO');
    });

    it('throws outside a monorepo in human mode', async () => {
      await fs.remove(path.join(tempRoot, 'package.json'));

      await expect(generateWorkspaceGraph({})).rejects.toThrow(/Not in a monorepo/);
    });
  });

  describe('buildWorkspaceSummary', () => {
    it('composes workspaces, contract graph, health and package manager', async () => {
      await writeWorkspaceConfig(VALID_CONFIG);

      const summary = await buildWorkspaceSummary();

      expect(summary.root).toBe(tempRoot);
      expect(summary.packageManager).toBe('pnpm');
      expect(summary.workspaces).toHaveLength(3);
      expect(summary.graph.apps).toHaveLength(2);
      expect(summary.graph.services).toHaveLength(1);
      expect(summary.health).toMatchObject({ status: expect.any(String), checks: expect.any(Array) });
    });

    it('throws outside a monorepo', async () => {
      await fs.remove(path.join(tempRoot, 'package.json'));

      await expect(buildWorkspaceSummary()).rejects.toThrow(/Not in a monorepo/);
    });
  });

  describe('buildConfigHealth', () => {
    it('normalizes the six health checks for a config', async () => {
      await writeWorkspaceConfig(VALID_CONFIG);
      // Stage the files the structure/git checks look for.
      await fs.writeFile(path.join(tempRoot, 'README.md'), '# test');
      await fs.ensureDir(path.join(tempRoot, '.git'));

      const health = await buildConfigHealth(path.join(tempRoot, 're-shell.workspaces.yaml'));

      expect(health.status).toBe('healthy');
      expect(health.checks.length).toBeGreaterThanOrEqual(6);
    });

    it('degrades to critical when config cannot be read', async () => {
      const health = await buildConfigHealth(path.join(tempRoot, 'missing.yaml'));

      expect(health.status).toBe('critical');
    });
  });

  describe('produceWorkspaceSummary', () => {
    it('emits the summary via ok()', async () => {
      await produceWorkspaceSummary({ json: true });

      const payload = vi.mocked(jsonOutput.ok).mock.calls[0][0];
      expect(payload.root).toBe(tempRoot);
      expect(payload.packageManager).toBe('pnpm');
    });

    it('emits a NOT_IN_MONOREPO failure outside a monorepo', async () => {
      await fs.remove(path.join(tempRoot, 'package.json'));

      await produceWorkspaceSummary({ json: true });

      expect(vi.mocked(jsonOutput.fail).mock.calls[0][0]).toBe('NOT_IN_MONOREPO');
    });
  });

  describe('initWorkspace', () => {
    it('writes a default config non-interactively with --yes', async () => {
      await initWorkspace({ yes: true });

      const configPath = path.join(tempRoot, 're-shell.workspaces.yaml');
      await expect(fs.pathExists(configPath)).resolves.toBe(true);
      const written = await fs.readFile(configPath, 'utf8');
      expect(written).toContain('name: my-workspace');
      expect(written).toContain('version: 2.0.0');
      expect(output()).toContain('Workspace configuration created');
      expect(output()).toContain('Next Steps');
    });

    it('includes detected services in the config', async () => {
      // apps/web + apps/api + packages/ui-kit are detected as services.
      await initWorkspace({ yes: true });

      const written = await fs.readFile(
        path.join(tempRoot, 're-shell.workspaces.yaml'),
        'utf8'
      );
      expect(written).toContain('web:');
      expect(written).toContain('type: frontend');
      expect(written).toContain('api:');
      expect(written).toContain('type: backend');
    });

    it('prompts for overwrite when the config already exists and declines', async () => {
      await fs.writeFile(path.join(tempRoot, 're-shell.workspaces.yaml'), 'existing: config');
      vi.mocked(prompts).mockResolvedValue({ overwrite: false } as never);

      await initWorkspace({});

      const written = await fs.readFile(
        path.join(tempRoot, 're-shell.workspaces.yaml'),
        'utf8'
      );
      expect(written).toBe('existing: config');
      expect(output()).toContain('Initialization cancelled');
    });

    it('overwrites the config when confirmed', async () => {
      await fs.writeFile(path.join(tempRoot, 're-shell.workspaces.yaml'), 'existing: config');
      vi.mocked(prompts)
        .mockResolvedValueOnce({ overwrite: true } as never)
        // runSetupWizard answers
        .mockResolvedValueOnce({ name: 'fresh' } as never)
        .mockResolvedValueOnce({ description: 'desc' } as never)
        .mockResolvedValueOnce({ version: '2.0.0' } as never)
        .mockResolvedValueOnce({ includeServices: false } as never);

      await initWorkspace({});

      const written = await fs.readFile(
        path.join(tempRoot, 're-shell.workspaces.yaml'),
        'utf8'
      );
      expect(written).toContain('name: fresh');
    });

    it('skips the overwrite prompt with --yes and rewrites', async () => {
      await fs.writeFile(path.join(tempRoot, 're-shell.workspaces.yaml'), 'existing: config');

      await initWorkspace({ yes: true });

      const written = await fs.readFile(
        path.join(tempRoot, 're-shell.workspaces.yaml'),
        'utf8'
      );
      expect(written).toContain('name: my-workspace');
    });

    it('throws when the wizard is cancelled at the name prompt', async () => {
      vi.mocked(prompts).mockResolvedValue({ name: undefined } as never);

      await expect(initWorkspace({})).rejects.toThrow(/Workspace name is required/);
    });

    it('prints detected frameworks from package.json deps in the wizard', async () => {
      await fs.outputJson(path.join(tempRoot, 'package.json'), {
        name: 'test-monorepo',
        private: true,
        workspaces: ['apps/*', 'packages/*'],
        dependencies: { react: '^18.0.0', vite: '^5.0.0' },
      });
      vi.mocked(prompts)
        .mockResolvedValueOnce({ name: 'wiz' } as never)
        .mockResolvedValueOnce({ description: '' } as never)
        .mockResolvedValueOnce({ version: '2.0.0' } as never)
        .mockResolvedValueOnce({ includeServices: false } as never);

      await initWorkspace({});

      // Frameworks from root package.json deps are surfaced to the user.
      expect(output()).toContain('react');
    });
  });

  describe('validateWorkspaceConfig', () => {
    it('rejects with exit(1) when no config exists', async () => {
      await validateWorkspaceConfig({});

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(output()).toContain('No workspace configuration found');
    });

    it('reports a WORKSPACE_NOT_FOUND error envelope in json mode', async () => {
      await validateWorkspaceConfig({ json: true });

      expect(vi.mocked(jsonOutput.jsonError).mock.calls[0][0]).toBe('WORKSPACE_NOT_FOUND');
    });

    it('accepts a valid config and prints the topology summary', async () => {
      await writeWorkspaceConfig(VALID_CONFIG);

      await validateWorkspaceConfig({});

      const text = output();
      expect(text).toContain('Workspace configuration is valid');
      expect(text).toContain('Summary:');
      expect(text).toContain('Services: 2');
      expect(text).toContain('Circular Dependencies: No');
    });

    it('fails with exit(1) and per-error fix hints for an invalid config', async () => {
      await writeWorkspaceConfig('name: x\nversion: "2.0.0"\nservices:\n  bad:\n    type: nope\n');

      await validateWorkspaceConfig({});

      const text = output();
      expect(text).toContain('Validation Failed');
      expect(text).toContain('💡 Fix:');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('checkWorkspaceHealth', () => {
    it('reports GOOD for a fully healthy config', async () => {
      await writeWorkspaceConfig(VALID_CONFIG);
      await fs.writeFile(path.join(tempRoot, 'README.md'), '# test');
      await fs.ensureDir(path.join(tempRoot, '.git'));
      await fs.writeFile(path.join(tempRoot, 'package-lock.json'), '{}');
      execSyncMock.mockReturnValue('');

      await checkWorkspaceHealth({});

      expect(output()).toContain('Overall workspace health: GOOD');
    });

    it('reports missing config guidance when neither config nor monorepo exists', async () => {
      await fs.remove(path.join(tempRoot, 'package.json'));

      await checkWorkspaceHealth({});

      expect(output()).toContain('No workspace configuration found');
    });

    it('emits a WORKSPACE_NOT_FOUND envelope in json mode', async () => {
      await fs.remove(path.join(tempRoot, 'package.json'));

      await checkWorkspaceHealth({ json: true });

      expect(vi.mocked(jsonOutput.jsonError).mock.calls[0][0]).toBe('WORKSPACE_NOT_FOUND');
    });

    it('derives checks from the discovered monorepo when no config exists', async () => {
      await checkWorkspaceHealth({});

      const text = output();
      expect(text).toContain('Workspace Health Check');
      expect(text).toContain('Workspaces');
      expect(text).toContain('3 workspace(s) detected');
    });
  });

  describe('migrateWorkspace', () => {
    it('guides the user when no config exists', async () => {
      await migrateWorkspace({});

      expect(output()).toContain('No workspace configuration found');
    });

    it('is a no-op when already at the target version', async () => {
      await writeWorkspaceConfig(VALID_CONFIG);

      await migrateWorkspace({ to: '2.0.0' });

      expect(output()).toContain('Already at target version');
    });

    it('refuses to migrate a config with validation errors', async () => {
      await writeWorkspaceConfig('name: x\nversion: "2.0.0"\nservices:\n  bad:\n    type: nope\n');

      await migrateWorkspace({ to: '3.0.0' });

      expect(output()).toContain('Cannot migrate: Configuration has errors');
    });

    it('previews changes without writing in dry-run mode', async () => {
      await writeWorkspaceConfig(
        'name: old\nversion: "1.0.0"\nworkspaces:\n  - name: web\n    framework: react\n'
      );

      await migrateWorkspace({ dryRun: true });

      const text = output();
      expect(text).toContain('[DRY RUN] Migration Preview');
      expect(text).toContain('Converted workspace "web" to service format');
      // Config is untouched.
      const content = await fs.readFile(
        path.join(tempRoot, 're-shell.workspaces.yaml'),
        'utf8'
      );
      expect(content).toContain('version: "1.0.0"');
    });

    it('migrates a 1.0.0 workspaces array to the 2.0.0 services object', async () => {
      await writeWorkspaceConfig(
        'name: old\nversion: "1.0.0"\nworkspaces:\n  - name: web\n    framework: react\n    path: apps/web\n'
      );

      await migrateWorkspace({ backup: false });

      const text = output();
      expect(text).toContain('Migration completed successfully');
      expect(text).toContain('Changes applied:');

      const content = await fs.readFile(
        path.join(tempRoot, 're-shell.workspaces.yaml'),
        'utf8'
      );
      expect(content).toContain('version: 2.0.0');
      expect(content).toContain('services:');
      expect(content).toContain('type: frontend');
      expect(content).not.toContain('workspaces:');
    });

    it('creates a timestamped backup before migrating', async () => {
      await writeWorkspaceConfig(
        'name: old\nversion: "1.0.0"\n'
      );

      await migrateWorkspace({});

      const backups = (await fs.readdir(tempRoot)).filter((f) =>
        f.startsWith('re-shell.workspaces.yaml.backup-')
      );
      expect(backups).toHaveLength(1);
      expect(output()).toContain('Backup created');
    });
  });

  describe('optimizeWorkspace', () => {
    it('guides the user when no config exists', async () => {
      await optimizeWorkspace({});

      expect(output()).toContain('No workspace configuration found');
    });

    it('emits a WORKSPACE_NOT_FOUND envelope in json mode', async () => {
      await optimizeWorkspace({ json: true });

      expect(vi.mocked(jsonOutput.jsonError).mock.calls[0][0]).toBe('WORKSPACE_NOT_FOUND');
    });

    it('refuses to optimize a config with validation errors', async () => {
      await writeWorkspaceConfig('name: x\nversion: "2.0.0"\nservices:\n  bad:\n    type: nope\n');

      await optimizeWorkspace({});

      expect(output()).toContain('Cannot optimize: Configuration has errors');
    });

    it('analyzes a compliant config and reports zero recommendations', async () => {
      // Fully-compliant config: health-check + auth features + scaling + kebab
      // names + no unreferenced deps.
      const compliant = `name: test-workspace
version: "2.0.0"
services:
  web:
    name: web
    type: frontend
    language: typescript
    framework: react
    path: apps/web
    features:
      - security
    healthCheck:
      path: /health
      interval: 30
      timeout: 5
      retries: 3
    scaling:
      min: 1
      max: 3
  api:
    name: api
    type: backend
    language: typescript
    framework: express
    path: apps/api
    features:
      - security
    healthCheck:
      path: /health
      interval: 30
      timeout: 5
      retries: 3
    scaling:
      min: 1
      max: 3
    dependsOn:
      - web
`;
      await writeWorkspaceConfig(compliant);

      await optimizeWorkspace({});

      const text = output();
      expect(text).toContain('Workspace Optimization');
      expect(text).toContain('Analysis Summary');
      expect(text).toContain('No optimization recommendations found');
    });

    it('reports recommendations with severity sections for a sparse config', async () => {
      const sparse = `name: test-workspace
version: "2.0.0"
services:
  web-app:
    name: web-app
    type: frontend
    language: typescript
    framework: react
    path: apps/web
  api:
    name: api
    type: backend
    language: typescript
    framework: express
    path: apps/api
    dependsOn:
      - web-app
`;
      await writeWorkspaceConfig(sparse);

      await optimizeWorkspace({});

      const text = output();
      expect(text).toContain('Analysis Summary');
      // Missing health checks + auth produce security recommendations.
      expect(text).toContain('Missing Health Checks');
    });

    it('emits a filtered JSON report in json mode', async () => {
      await writeWorkspaceConfig(VALID_CONFIG);

      await optimizeWorkspace({ json: true });

      const payload = JSON.parse(
        logSpy.mock.calls.map((c) => c.join(' ')).filter((l) => l.trim().startsWith('{')).at(-1)!
      );
      expect(payload).toHaveProperty('recommendations');
      expect(payload).toHaveProperty('summary');
      expect(payload).toHaveProperty('estimatedImpact');
    });
  });
});
