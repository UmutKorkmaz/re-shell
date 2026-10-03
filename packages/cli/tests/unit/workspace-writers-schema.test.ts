import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SCHEMA_MODELINE } from '../../src/utils/workspace-yaml';
import { validateWorkspaceFile } from '../../src/utils/schema-generator';
import {
  generateWorkspaceConfig,
  initWorkspace,
  migrateWorkspace,
  type ProjectDetection,
  type SetupResponses,
} from '../../src/commands/workspace';
import { manageWorkspaceDefinition } from '../../src/commands/workspace-definition';
import {
  createDefaultWorkspaceDefinition,
  loadWorkspaceDefinition,
  saveWorkspaceDefinition,
} from '../../src/utils/workspace-schema';
import { importFromMonorepo } from '../../src/commands/import-monorepo';
import { migrateMonorepo, renderWorkspaceYaml } from '../../src/commands/migrate-monorepo';
import { autoRegisterInWorkspace } from '../../src/commands/create';

// One test (group) per code path that writes a re-shell.workspaces.yaml. Every
// writer's real output is validated with ajv against the canonical v2 JSON
// Schema (via validateWorkspaceFile), not against a copy or a mock.

vi.mock('prompts', () => ({ default: vi.fn() }));
// glob v10+ has no CJS default export; the import command's `glob.sync` needs an
// interop shim under vitest. Back it with the real globSync implementation.
vi.mock('glob', async importOriginal => {
  const actual = await importOriginal<typeof import('glob')>();
  return { ...actual, default: { sync: actual.globSync } };
});

import prompts from 'prompts';

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const promptsMock = vi.mocked(prompts);

let tmp: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-writers-'));
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  promptsMock.mockReset();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.remove(tmp);
});

function logged(): string {
  return logSpy.mock.calls.map(c => c.join(' ')).join('\n');
}

/** Assert a written file passes the canonical v2 schema; returns the parsed document. */
async function expectValidV2(file: string): Promise<Record<string, any>> {
  const result = await validateWorkspaceFile(file);
  expect(result.errors, `${file}: ${JSON.stringify(result.errors)}`).toEqual([]);
  expect(result.valid).toBe(true);
  return yaml.load(await fs.readFile(file, 'utf8')) as Record<string, any>;
}

function stageDir(name: string): string {
  const dir = path.join(tmp, name);
  fs.mkdirpSync(dir);
  return dir;
}

describe('workspace init (initWorkspace / generateWorkspaceConfig)', () => {
  const EMPTY: ProjectDetection = {
    hasPackageJson: false,
    hasPython: false,
    hasGo: false,
    hasRust: false,
    hasJava: false,
    hasDocker: false,
    frameworks: [],
    services: [],
  };

  it('--yes in an empty directory writes a valid v2 file (services is {} not null)', async () => {
    const dir = stageDir('empty');
    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    await initWorkspace({ yes: true });

    const file = path.join(dir, 're-shell.workspaces.yaml');
    const text = await fs.readFile(file, 'utf8');
    expect(text.split('\n')[0]).toBe(SCHEMA_MODELINE);
    const doc = await expectValidV2(file);
    expect(doc.name).toBe('my-workspace');
    expect(doc.version).toBe('2.0.0');
    expect(doc.services).toEqual({});
    expect(text).toContain('services: {}');
  });

  it('--yes with detected services writes a valid file with sanitised service names', async () => {
    const dir = stageDir('with-services');
    await fs.outputJson(path.join(dir, 'package.json'), { name: 'root' });
    await fs.outputJson(path.join(dir, 'apps', 'Web_App', 'package.json'), {
      name: 'web',
      dependencies: { react: '^18' },
      devDependencies: { typescript: '^5' },
    });
    await fs.outputJson(path.join(dir, 'apps', 'api', 'package.json'), {
      name: 'api',
      dependencies: { express: '^4' },
    });
    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    await initWorkspace({ yes: true });

    const doc = await expectValidV2(path.join(dir, 're-shell.workspaces.yaml'));
    expect(Object.keys(doc.services).sort()).toEqual(['api', 'web-app']);
    expect(doc.services['web-app']).toMatchObject({
      name: 'web-app',
      type: 'frontend',
      language: 'typescript',
      framework: 'react',
      path: 'apps/Web_App',
    });
  });

  it('keeps colliding sanitised service names distinct', async () => {
    const responses: SetupResponses = { name: 'ws', version: '2.0.0', includeServices: true };
    const detection: ProjectDetection = {
      ...EMPTY,
      services: [
        { name: 'My_App', path: 'apps/My_App', type: 'frontend', language: 'typescript', framework: 'react' },
        { name: 'my-app', path: 'packages/my-app', type: 'frontend', language: 'typescript', framework: 'vue' },
      ],
    };
    const file = path.join(tmp, 'collide.yaml');
    await fs.writeFile(file, generateWorkspaceConfig(responses, detection));

    const doc = await expectValidV2(file);
    expect(Object.keys(doc.services)).toEqual(['my-app', 'my-app-2']);
    expect(doc.services['my-app-2'].name).toBe('my-app-2');
  });

  it('serialises special characters in the description safely', async () => {
    const responses: SetupResponses = {
      name: 'ws',
      version: '2.0.0',
      description: 'Platform: payments # core "v2"',
      includeServices: false,
    };
    const file = path.join(tmp, 'special.yaml');
    await fs.writeFile(file, generateWorkspaceConfig(responses, EMPTY));

    const doc = await expectValidV2(file);
    expect(doc.description).toBe('Platform: payments # core "v2"');
  });

  it('omits detected services unless the user opted in, still valid', async () => {
    const detection: ProjectDetection = {
      ...EMPTY,
      services: [{ name: 'web', path: 'apps/web', type: 'frontend', language: 'typescript', framework: 'react' }],
    };
    const file = path.join(tmp, 'optout.yaml');
    await fs.writeFile(file, generateWorkspaceConfig({ name: 'ws', version: '2.0.0', includeServices: false }, detection));

    const doc = await expectValidV2(file);
    expect(doc.services).toEqual({});
  });

  it('never offers the legacy 1.0.0 config version (it fails v2 validation)', async () => {
    const dir = stageDir('interactive');
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    promptsMock
      .mockResolvedValueOnce({ name: 'fresh' } as never)
      .mockResolvedValueOnce({ description: 'desc' } as never);

    await initWorkspace({});

    for (const call of promptsMock.mock.calls) {
      const question = call[0] as { name?: string; choices?: Array<{ value: string }> };
      expect(question.name).not.toBe('version');
    }
    const doc = await expectValidV2(path.join(dir, 're-shell.workspaces.yaml'));
    expect(doc.name).toBe('fresh');
    expect(doc.version).toBe('2.0.0');
  });
});

describe('workspace-def init (manageWorkspaceDefinition / workspace-schema)', () => {
  it('init writes a file that is valid v2 AND loads in the legacy definition validator', async () => {
    const file = path.join(tmp, 're-shell.workspaces.yaml');
    promptsMock.mockResolvedValue({ name: 'my-platform', description: 'Core: platform # services' } as never);

    await manageWorkspaceDefinition({ init: true, output: file });

    const text = await fs.readFile(file, 'utf8');
    expect(text.split('\n')[0]).toBe(SCHEMA_MODELINE);
    const doc = await expectValidV2(file);
    expect(doc.name).toBe('my-platform');
    expect(doc.version).toBe('2.0.0');
    expect(doc.services).toEqual({});
    expect(doc.description).toBe('Core: platform # services');

    // The same file is still a valid workspace definition for the other
    // `workspace-def` subcommands (validate, auto-detect, fix...).
    const loaded = await loadWorkspaceDefinition(file);
    expect(loaded.name).toBe('my-platform');
    expect(Object.keys(loaded.types)).toContain('app');
  });

  it('createDefaultWorkspaceDefinition + saveWorkspaceDefinition (the auto-detect new-file path) is valid v2', async () => {
    const file = path.join(tmp, 'detected.yaml');
    await saveWorkspaceDefinition(createDefaultWorkspaceDefinition('monorepo'), file);

    const doc = await expectValidV2(file);
    expect(doc.services).toEqual({});
  });

  it('does not add the v2 modeline to a legacy 1.0 definition it re-saves', async () => {
    const file = path.join(tmp, 'legacy.yaml');
    await saveWorkspaceDefinition(
      createDefaultWorkspaceDefinition('legacy', { version: '1.0', services: undefined }),
      file
    );

    const text = await fs.readFile(file, 'utf8');
    expect(text).not.toContain('yaml-language-server');
    expect(text).toMatch(/version: ["']1\.0["']/);
  });
});

describe('workspace migrate-monorepo --from nx|turbo', () => {
  for (const [fixture, source] of [
    ['nx-sample', 'nx'],
    ['turbo-sample', 'turbo'],
  ] as const) {
    it(`${source}: the rendered YAML written to --output is valid v2 with a schema modeline`, async () => {
      const cwd = stageDir(fixture);
      await fs.copy(path.join(FIXTURES, fixture), cwd);

      const result = await migrateMonorepo({ source, cwd });
      const file = path.join(tmp, `${source}.yaml`);
      await fs.writeFile(file, result.yaml);

      expect(result.yaml.split('\n')[0]).toBe(SCHEMA_MODELINE);
      const doc = await expectValidV2(file);
      expect(Object.keys(doc.services).length).toBeGreaterThan(0);
    });
  }

  it('a workspace with no projects renders services as {} and is still valid', async () => {
    const file = path.join(tmp, 'none.yaml');
    await fs.writeFile(file, renderWorkspaceYaml('empty-ws', 'nx', []));

    const doc = await expectValidV2(file);
    expect(doc.services).toEqual({});
  });
});

describe('workspace import (importFromMonorepo)', () => {
  it('writes valid v2 for scoped names, collisions, missing frameworks and scoped dependencies', async () => {
    const root = stageDir('import');
    await fs.outputJson(path.join(root, 'package.json'), { workspaces: ['apps/*', 'libs/*'], packageManager: 'pnpm@9.15.9' });
    await fs.outputJson(path.join(root, 'apps/dashboard/package.json'), {
      name: '@scope/dashboard',
      dependencies: { vue: '^3', '@types/node': '^20' },
      scripts: { 'build:all': 'vite build', dev: 'vite' },
    });
    await fs.outputJson(path.join(root, 'apps/dashboard-two/package.json'), {
      name: '@other/dashboard',
      dependencies: { react: '^18' },
    });
    await fs.outputJson(path.join(root, 'apps/user-api/package.json'), { name: 'user-api' }); // backend, no framework
    await fs.outputJson(path.join(root, 'libs/shared/package.json'), { name: 'Shared_Lib' }); // library, no framework
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    promptsMock.mockResolvedValue({ value: true } as never);

    await importFromMonorepo();

    const file = path.join(root, 're-shell.workspaces.yaml');
    expect((await fs.readFile(file, 'utf8')).split('\n')[0]).toBe(SCHEMA_MODELINE);
    const doc = await expectValidV2(file);
    expect(Object.keys(doc.services).sort()).toEqual(['dashboard', 'dashboard-2', 'shared-lib', 'user-api']);
    // Both scoped packages sanitise to "dashboard"; the second gets a suffix and
    // each keeps its original npm name in metadata.
    const originals = ['dashboard', 'dashboard-2'].map(key => doc.services[key].metadata.originalName).sort();
    expect(originals).toEqual(['@other/dashboard', '@scope/dashboard']);
    const scoped = ['dashboard', 'dashboard-2']
      .map(key => doc.services[key])
      .find(svc => svc.metadata.originalName === '@scope/dashboard');
    expect(scoped.dependencies.production['@types/node']).toBe('^20');
    expect(scoped.scripts['build:all']).toBe('vite build');
    // framework is required by the schema even when none was detected.
    expect(doc.services['user-api']).toMatchObject({ type: 'backend', framework: 'vanilla' });
    expect(doc.services['shared-lib']).toMatchObject({ type: 'worker', framework: 'vanilla' });
    expect(doc.packageManager).toBe('pnpm@9.15.9');
  });
});

describe('workspace migrate (1.0.0 -> 2.0.0)', () => {
  async function migrate(content: string): Promise<{ file: string; doc: Record<string, any> }> {
    const dir = stageDir('migrate');
    const file = path.join(dir, 're-shell.workspaces.yaml');
    await fs.writeFile(file, content);
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    await migrateWorkspace({ backup: false });
    return { file, doc: await expectValidV2(file) };
  }

  it('converts a legacy workspaces array into valid v2 services', async () => {
    const { file, doc } = await migrate(
      [
        'name: legacy',
        'version: "1.0.0"',
        'workspaces:',
        '  - name: Web App',
        '    framework: react',
        '    path: apps/web',
        '    port: 3000',
        '  - name: tools',
        '    description: "Build: scripts # misc"',
        '  - path: apps/unnamed',
        '',
      ].join('\n')
    );

    expect((await fs.readFile(file, 'utf8')).split('\n')[0]).toBe(SCHEMA_MODELINE);
    expect(doc.version).toBe('2.0.0');
    expect(Object.keys(doc.services)).toEqual(['web-app', 'tools', 'service-3']);
    expect(doc.services['web-app'].type).toBe('frontend');
    // No framework -> worker (not the invalid type "service") with the default framework.
    expect(doc.services['tools']).toMatchObject({ type: 'worker', framework: 'vanilla', language: 'typescript' });
    expect(doc.services['tools'].description).toBe('Build: scripts # misc');
    expect(doc).not.toHaveProperty('workspaces');
  });

  it('writes services as {} (not null) when the legacy config has none', async () => {
    const { doc } = await migrate('name: old\nversion: "1.0.0"\n');
    expect(doc.services).toEqual({});
  });

  it('keeps fields the old emitter dropped (deployment, tasks, ...)', async () => {
    const { doc } = await migrate(
      [
        'name: old',
        'version: "1.0.0"',
        'tasks:',
        '  build:',
        '    dependsOn: ["^build"]',
        'deployment:',
        '  platform: kubernetes',
        'workspaces:',
        '  - name: web',
        '    framework: react',
        '',
      ].join('\n')
    );
    expect(doc.tasks).toEqual({ build: { dependsOn: ['^build'] } });
    expect(doc.deployment).toEqual({ platform: 'kubernetes' });
  });

  it('does not stamp the v2 modeline on a document that is not migrated to 2.0.0', async () => {
    const dir = stageDir('migrate-other');
    const file = path.join(dir, 're-shell.workspaces.yaml');
    await fs.writeFile(file, 'name: old\nversion: "1.0.0"\n');
    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    await migrateWorkspace({ backup: false, to: '3.0.0' });

    const text = await fs.readFile(file, 'utf8');
    expect(text).not.toContain('yaml-language-server');
    expect(text).toMatch(/version: ["']?1\.0\.0["']?/);
  });

  it('warns (instead of claiming success) when the migrated result still violates the v2 schema', async () => {
    const dir = stageDir('migrate-bad');
    const file = path.join(dir, 're-shell.workspaces.yaml');
    await fs.writeFile(file, 'name: old\nversion: "1.0.0"\nworkspaces:\n  - name: web\n    framework: react\n    port: 80\n');
    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    await migrateWorkspace({ backup: false });

    // Port 80 is below the schema minimum (1024): the migration cannot fix that,
    // so it must say so rather than report a clean migration.
    expect(logged()).toContain('Result does not satisfy the v2 schema at /services/web/port');
    const result = await validateWorkspaceFile(file);
    expect(result.valid).toBe(false);
  });
});

describe('create: autoRegisterInWorkspace', () => {
  async function stageWorkspace(): Promise<{ root: string; file: string }> {
    const root = stageDir('create');
    const file = path.join(root, 're-shell.workspaces.yaml');
    await fs.writeFile(
      file,
      generateWorkspaceConfig({ name: 'ws', version: '2.0.0', includeServices: false }, {
        hasPackageJson: false,
        hasPython: false,
        hasGo: false,
        hasRust: false,
        hasJava: false,
        hasDocker: false,
        frameworks: [],
        services: [],
      })
    );
    return { root, file };
  }

  it('registers a service into a freshly initialised workspace and the result stays valid, modeline intact', async () => {
    const { root, file } = await stageWorkspace();

    await autoRegisterInWorkspace(root, [
      { name: 'my-app', type: 'frontend', framework: 'react', port: '5173', relPath: path.join('apps', 'my-app') },
    ]);

    expect((await fs.readFile(file, 'utf8')).split('\n')[0]).toBe(SCHEMA_MODELINE);
    const doc = await expectValidV2(file);
    expect(doc.services['my-app']).toMatchObject({
      name: 'my-app',
      type: 'frontend',
      language: 'typescript',
      framework: 'react',
      port: 5173,
      path: path.join('apps', 'my-app'),
    });
  });

  it('registers a service with no detected framework without producing an invalid file', async () => {
    const { root, file } = await stageWorkspace();

    await autoRegisterInWorkspace(root, [
      { name: 'worker-svc', type: 'backend', port: '4000', relPath: path.join('packages', 'worker-svc') },
    ]);

    const doc = await expectValidV2(file);
    expect(doc.services['worker-svc'].framework).toBe('vanilla');
  });

  it('is a no-op (no file created) when the workspace has no config', async () => {
    const root = stageDir('create-none');

    await autoRegisterInWorkspace(root, [
      { name: 'x', type: 'frontend', framework: 'react', port: '5173', relPath: path.join('apps', 'x') },
    ]);

    expect(await fs.pathExists(path.join(root, 're-shell.workspaces.yaml'))).toBe(false);
  });
});
