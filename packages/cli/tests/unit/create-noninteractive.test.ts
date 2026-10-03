import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import prompts from 'prompts';
import { CreateError, createProject, type CreateResult } from '../../src/commands/create';
import { findMonorepoRoot } from '../../src/utils/monorepo';
import { createDryRunResponseSchema, createResponseSchema } from '@re-shell/contracts';

/**
 * `create` without a terminal: every mode must finish (never wait on a prompt),
 * produce what it claims (a runnable app, or an honestly labelled skeleton),
 * fail explicitly with a coded error when it cannot, and have a dry run that
 * lists exactly the files a real run writes.
 *
 * Prompts are mocked to THROW so any attempt to ask a question fails the test.
 */

const hoisted = vi.hoisted(() => ({
  compatibility: undefined as
    | undefined
    | { valid: boolean; compatibility: string; warnings: string[]; suggestions: string[] },
}));

vi.mock('prompts', () => ({
  default: vi.fn(() => {
    throw new Error('prompts must not be called in a non-interactive run');
  }),
}));

vi.mock('../../src/utils/monorepo', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/utils/monorepo')>();
  return { ...original, findMonorepoRoot: vi.fn(original.findMonorepoRoot) };
});

vi.mock('../../src/utils/database', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/utils/database')>();
  return {
    ...original,
    performProjectHealthCheck: vi.fn(async () => ({
      overallStatus: 'healthy' as const,
      checks: [],
      timestamp: '2026-01-01T00:00:00.000Z',
      projectPath: '/healthy',
    })),
    validateFrameworkCompatibility: vi.fn((frontend: string, backend: string) =>
      hoisted.compatibility ?? original.validateFrameworkCompatibility(frontend, backend)
    ),
  };
});

const promptsMock = vi.mocked(prompts);
const monorepoMock = vi.mocked(findMonorepoRoot);
const originalIsTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');

let tempRoot: string;
let logSpy: ReturnType<typeof vi.spyOn>;

function output(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

function read(...segments: string[]): string {
  return fs.readFileSync(path.join(tempRoot, ...segments), 'utf8');
}

function readJson(...segments: string[]): any {
  return fs.readJsonSync(path.join(tempRoot, ...segments));
}

function exists(...segments: string[]): boolean {
  return fs.existsSync(path.join(tempRoot, ...segments));
}

async function created(name: string, options: Parameters<typeof createProject>[1]) {
  const result = await createProject(name, options);
  expect(result.status).toBe('created');
  if (result.status !== 'created') throw new Error('unreachable');
  return result.response;
}

async function dryRun(name: string, options: Parameters<typeof createProject>[1]) {
  const result: CreateResult = await createProject(name, { ...options, dryRun: true });
  expect(result.status).toBe('dry-run');
  if (result.status !== 'dry-run') throw new Error('unreachable');
  return result.response;
}

async function errorOf(promise: Promise<unknown>): Promise<CreateError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(CreateError);
    return error as CreateError;
  }
  throw new Error('expected createProject to reject');
}

/** Make tempRoot look like an existing Re-Shell monorepo root. */
function stageMonorepo(withRegistry = false): void {
  fs.writeJsonSync(path.join(tempRoot, 'package.json'), {
    name: 'host',
    private: true,
    workspaces: ['apps/*', 'packages/*', 'services/*'],
  });
  fs.ensureDirSync(path.join(tempRoot, 'apps'));
  monorepoMock.mockResolvedValue(tempRoot);
  if (withRegistry) {
    fs.writeFileSync(
      path.join(tempRoot, 're-shell.workspaces.yaml'),
      'name: host\nversion: 2.0.0\nservices: {}\n'
    );
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.compatibility = undefined;
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-create-headless-'));
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
  // stdin is NOT a terminal (closed / piped), exactly like CI and agents.
  Object.defineProperty(process.stdin, 'isTTY', { value: undefined, configurable: true, writable: true });
  monorepoMock.mockResolvedValue(null);
});

afterEach(async () => {
  expect(promptsMock).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  if (originalIsTTY) Object.defineProperty(process.stdin, 'isTTY', originalIsTTY);
  else delete (process.stdin as { isTTY?: boolean }).isTTY;
  await fs.remove(tempRoot);
});

describe('top-level modes without a terminal', () => {
  it('frontend: --frontend scaffolds a runnable app at apps/<name> from the template system', async () => {
    const response = await created('fe-only', { frontend: 'react-ts' });

    expect(createResponseSchema.safeParse(response).success).toBe(true);
    expect(response).toMatchObject({ mode: 'frontend', skeleton: false, dryRun: false });
    expect(response.files).toEqual(
      expect.arrayContaining([
        'fe-only/package.json',
        'fe-only/pnpm-workspace.yaml',
        'fe-only/apps/fe-only/package.json',
        'fe-only/apps/fe-only/index.html',
        'fe-only/apps/fe-only/src/main.tsx',
        'fe-only/apps/fe-only/vite.config.ts',
      ])
    );

    const app = readJson('fe-only', 'apps', 'fe-only', 'package.json');
    expect(app.scripts.dev).toContain('vite');
    expect(app.scripts.build).toBeTruthy();
    expect(app.dependencies.react).toBeDefined();

    // Honest, runnable next steps (this is NOT a skeleton).
    expect(response.nextSteps).toEqual(['cd fe-only', 'pnpm install', 'pnpm run dev']);
    expect(output()).toContain('Scaffolded react-ts frontend');
    expect(output()).not.toContain('empty workspace skeleton');
  });

  it('frontend: honours the chosen framework instead of silently scaffolding React', async () => {
    await created('vue-app', { frontend: 'vue-ts' });
    const app = readJson('vue-app', 'apps', 'vue-app', 'package.json');
    expect(app.dependencies.vue).toBeDefined();
    expect(app.dependencies.react).toBeUndefined();
  });

  it('frontend: a bare create (no flags, no TTY) defaults to react-ts and says so', async () => {
    const response = await created('bare', {});
    expect(response.mode).toBe('frontend');
    expect(response.notes.join(' ')).toContain('defaulting to a "react-ts" frontend');
    expect(exists('bare', 'apps', 'bare', 'package.json')).toBe(true);
  });

  it('backend: --backend creates just the API plus the minimal workspace files', async () => {
    const response = await created('be-only', { backend: 'express' });

    expect(response.mode).toBe('backend');
    expect(exists('be-only', 'apps', 'be-only', 'package.json')).toBe(true);
    expect(exists('be-only', 'package.json')).toBe(true);
    expect(exists('be-only', 'pnpm-workspace.yaml')).toBe(true);
    // No frontend app or shell came along (the old --template react-ts default made it fullstack).
    expect(exists('be-only', 'apps', 'be-only-api')).toBe(false);
    expect(fs.readdirSync(path.join(tempRoot, 'be-only', 'apps'))).toEqual(['be-only']);
    expect(response.files.some(f => f.endsWith('index.html'))).toBe(false);
    const apiPkg = readJson('be-only', 'apps', 'be-only', 'package.json');
    expect(apiPkg.name).toBe('be-only');
    expect(apiPkg.dependencies?.react).toBeUndefined();
    expect(output()).toContain('Express.js API');
  });

  it('backend: --template <backend id> is the same as --backend', async () => {
    const response = await created('tpl-api', { template: 'fastify' });
    expect(response.mode).toBe('backend');
    expect(exists('tpl-api', 'apps', 'tpl-api', 'package.json')).toBe(true);
  });

  it('fullstack: --fullstack without --backend uses the documented default backend (express)', async () => {
    const response = await created('fs-app', { fullstack: true });

    expect(response.mode).toBe('fullstack');
    expect(exists('fs-app', 'apps', 'fs-app-api', 'package.json')).toBe(true);
    expect(exists('fs-app', 'apps', 'fs-app', 'package.json')).toBe(true);
    expect(response.notes.some(n => n.includes('default backend "express"'))).toBe(true);
    // The frontend proxies /api to the API's port.
    expect(read('fs-app', 'apps', 'fs-app', 'vite.config.ts')).toContain("'/api': 'http://localhost:3000'");
    // Distinct package names so the two apps do not collide in the workspace.
    const names = [
      readJson('fs-app', 'apps', 'fs-app', 'package.json').name,
      readJson('fs-app', 'apps', 'fs-app-api', 'package.json').name,
    ];
    expect(new Set(names).size).toBe(2);
  });

  it('fullstack: --backend plus --frontend honours both (and a non-react frontend stays non-react)', async () => {
    await created('mixed', { backend: 'fastify', frontend: 'vue' });
    expect(readJson('mixed', 'apps', 'mixed', 'package.json').dependencies.vue).toBeDefined();
    expect(exists('mixed', 'apps', 'mixed-api', 'package.json')).toBe(true);
  });

  it('skeleton: --template blank is an empty workspace and says it is not runnable', async () => {
    const response = await created('blank-ws', { template: 'blank' });

    expect(response).toMatchObject({ mode: 'skeleton', skeleton: true });
    expect(fs.readdirSync(path.join(tempRoot, 'blank-ws', 'apps'))).toEqual([]);
    expect(response.nextSteps.join('\n')).toMatch(/empty|nothing is runnable/);
    expect(response.nextSteps.join('\n')).toContain('re-shell create <app> --frontend');
    expect(output()).toContain('empty workspace skeleton');
    expect(read('blank-ws', 'README.md')).toContain('empty skeleton');
    expect(read('blank-ws', 'README.md')).not.toMatch(/Start every app in development mode/);
  });

  it('writes services/* into both workspace globs so generated services are visible', async () => {
    await created('globs', { frontend: 'react-ts' });
    expect(readJson('globs', 'package.json').workspaces).toEqual([
      'apps/*',
      'packages/*',
      'libs/*',
      'tools/*',
      'services/*',
    ]);
    const workspaceYaml = yaml.load(read('globs', 'pnpm-workspace.yaml')) as { packages: string[] };
    expect(workspaceYaml.packages).toContain('services/*');
  });

  it('non-pnpm managers get npm-run-all scripts and no pnpm-workspace.yaml', async () => {
    await created('npm-app', { backend: 'express', packageManager: 'npm' });
    const root = readJson('npm-app', 'package.json');
    expect(root.scripts.dev).toBe('npm-run-all --parallel dev:*');
    expect(root.scripts['dev:npm-app']).toBe('cd apps/npm-app && npm run dev');
    expect(root.devDependencies['npm-run-all']).toBeDefined();
    expect(exists('npm-app', 'pnpm-workspace.yaml')).toBe(false);
  });

  it('applies --db to the generated API (the database integration adds files)', async () => {
    const plain = await dryRun('db-none', { backend: 'express' });
    const withDb = await dryRun('db-none', { backend: 'express', db: 'prisma' });
    expect(withDb.files.length).toBeGreaterThan(plain.files.length);
  });
});

describe('polyglot and microfrontend without a terminal', () => {
  it('polyglot --yes uses documented defaults: express gateway, react frontend, two services', async () => {
    const response = await created('poly', { polyglot: true, yes: true });

    expect(response.mode).toBe('polyglot');
    expect(exists('poly', 'gateway', 'package.json')).toBe(true);
    expect(exists('poly', 'frontend', 'package.json')).toBe(true);
    expect(exists('poly', 'services', 'typescript-service-1', 'package.json')).toBe(true);
    expect(exists('poly', 'services', 'python-service-2')).toBe(true);
    expect(exists('poly', 'docker-compose.yml')).toBe(true);
    expect(response.notes.join('\n')).toContain('"express"');
    expect(response.nextSteps).toEqual(['cd poly', 'pnpm install', 'pnpm run dev']);
  });

  it('polyglot root scripts fan out recursively under pnpm (a build:* pattern would silently run nothing)', async () => {
    await created('poly-scripts', { polyglot: true });
    const root = readJson('poly-scripts', 'package.json');
    expect(root.scripts.dev).toBe('pnpm run --parallel -r dev');
    expect(root.scripts.build).toBe('pnpm run --parallel -r build');
    expect(root.scripts.test).toBe('pnpm run --parallel -r test');
  });

  it('polyglot gateway source is valid for hyphenated service names', async () => {
    await created('poly-gw', { polyglot: true });
    const source = read('poly-gw', 'gateway', 'src', 'index.ts');
    expect(source).toContain('process.env.TYPESCRIPT_SERVICE_1_SERVICE_URL');
    expect(source).not.toMatch(/process\.env\.[A-Z0-9_]*-/);
    expect(source).toContain("'^/api/typescript-service-1': ''");
    expect(source).not.toMatch(/`\^\/api\//);
    expect(read('poly-gw', 'gateway', '.env.example')).toContain('PYTHON_SERVICE_2_SERVICE_URL=');
  });

  it('polyglot honours --gateway, --services, --frontend and --db', async () => {
    await created('poly-custom', {
      polyglot: true,
      gateway: 'fastify',
      services: 'users:fastapi,orders:express',
      frontend: 'vue',
      db: 'none',
    });
    const gateway = readJson('poly-custom', 'gateway', 'package.json');
    expect(gateway.dependencies.fastify).toBeDefined();
    expect(gateway.dependencies['@fastify/http-proxy']).toBeDefined();
    expect(exists('poly-custom', 'services', 'users')).toBe(true);
    expect(exists('poly-custom', 'services', 'orders', 'package.json')).toBe(true);
    expect(readJson('poly-custom', 'frontend', 'package.json').dependencies.vue).toBeDefined();
  });

  it('polyglot fails explicitly on bad input and writes nothing', async () => {
    const one = await errorOf(createProject('p1', { polyglot: true, services: 'only:express' }));
    expect(one.code).toBe('CREATE_INVALID_OPTIONS');
    expect(one.message).toContain('at least 2 services');

    const unknown = await errorOf(createProject('p2', { polyglot: true, services: 'a:express,b:nope-js' }));
    expect(unknown.code).toBe('TEMPLATE_NOT_FOUND');

    const gateway = await errorOf(createProject('p3', { polyglot: true, gateway: 'nginx' }));
    expect(gateway.code).toBe('TEMPLATE_NOT_FOUND');

    const frontend = await errorOf(createProject('p4', { polyglot: true, frontend: 'jekyll' }));
    expect(frontend.code).toBe('CREATE_INVALID_OPTIONS');

    for (const name of ['p1', 'p2', 'p3', 'p4']) expect(exists(name)).toBe(false);
  });

  it('microfrontend --yes uses documented defaults: react-ts shell and one react remote', async () => {
    const response = await created('mf-app', { microfrontend: true, yes: true });

    expect(response.mode).toBe('microfrontend');
    expect(exists('mf-app', 'shell', 'package.json')).toBe(true);
    expect(exists('mf-app', 'remotes', 'remote-1', 'package.json')).toBe(true);
    expect(exists('mf-app', 'shared', 'package.json')).toBe(true);
    expect(readJson('mf-app', 'package.json').scripts.build).toBe('pnpm run --parallel -r build');
    expect(response.notes.join('\n')).toContain('"react-ts"');
  });

  it('microfrontend with --framework no longer hangs (the shell framework comes from the flag)', async () => {
    const response = await created('mf-vue', { microfrontend: true, framework: 'vue' });
    expect(response.mode).toBe('microfrontend');
    expect(readJson('mf-vue', 'shell', 'package.json').dependencies.vue).toBeDefined();
  });

  it('microfrontend webpack config is valid JS for hyphenated remote names', async () => {
    await created('mf-names', { microfrontend: true, remotes: 'cart-view,search' });
    const shell = read('mf-names', 'shell', 'webpack.config.js');
    // Quoted key (import specifier) + identifier-safe container name before the "@".
    expect(shell).toContain("'cart-view': 'cart_view@http://localhost:3001/remoteEntry.js'");
    expect(shell).toContain("'search': 'search@http://localhost:3002/remoteEntry.js'");
    const remote = read('mf-names', 'remotes', 'cart-view', 'webpack.config.js');
    expect(remote).toContain("name: 'cart_view'");
    // The webpack config must at least parse.
    expect(() => new Function(shell.replace(/require\([^)]*\)/g, '({})').replace(/module\.exports\s*=/, 'return'))).not.toThrow();
  });

  it('microfrontend rejects an unsupported shell/remote framework with suggestions', async () => {
    const shell = await errorOf(createProject('m1', { microfrontend: true, framework: 'jekyll' }));
    expect(shell.code).toBe('TEMPLATE_NOT_FOUND');
    const remote = await errorOf(createProject('m2', { microfrontend: true, remotes: 'a:rect' }));
    expect(remote.code).toBe('TEMPLATE_NOT_FOUND');
    expect(exists('m1')).toBe(false);
    expect(exists('m2')).toBe(false);
  });
});

describe('explicit failures instead of silent skeletons or hangs', () => {
  it('rejects an unknown template with close matches and creates nothing', async () => {
    const error = await errorOf(createProject('x', { template: 'go-gin' }));
    expect(error.code).toBe('TEMPLATE_NOT_FOUND');
    expect(error.message).toContain('Did you mean: gin');
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('rejects an unknown backend / frontend / framework', async () => {
    expect((await errorOf(createProject('x', { backend: 'nope-js' }))).code).toBe('TEMPLATE_NOT_FOUND');
    expect((await errorOf(createProject('x', { frontend: 'react-tsx' }))).code).toBe('TEMPLATE_NOT_FOUND');
    expect((await errorOf(createProject('x', { framework: 'go-gin' }))).code).toBe('TEMPLATE_NOT_FOUND');
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('rejects the unknown template even for a dry run', async () => {
    const error = await errorOf(createProject('x', { template: 'go-gin', dryRun: true }));
    expect(error.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('rejects invalid options with CREATE_INVALID_OPTIONS', async () => {
    for (const options of [
      { type: 'full-stack' as never },
      { packageManager: 'cargo' },
      { port: '99999' },
      { route: 'no-slash' },
      { polyglot: true, microfrontend: true },
    ]) {
      expect((await errorOf(createProject('x', options))).code, JSON.stringify(options)).toBe(
        'CREATE_INVALID_OPTIONS'
      );
    }
  });

  it('refuses an existing top-level target with CREATE_TARGET_EXISTS and does not touch it', async () => {
    await created('dup', { frontend: 'react-ts' });
    fs.writeFileSync(path.join(tempRoot, 'dup', 'precious.txt'), 'mine');

    const error = await errorOf(createProject('dup', { frontend: 'react-ts' }));
    expect(error.code).toBe('CREATE_TARGET_EXISTS');
    expect(error.message).toContain('Directory already exists');
    expect(read('dup', 'precious.txt')).toBe('mine');
  });

  it('--force overwrites files in place and leaves unrelated files alone', async () => {
    await created('forced', { frontend: 'react-ts' });
    fs.writeFileSync(path.join(tempRoot, 'forced', 'precious.txt'), 'mine');
    fs.writeFileSync(path.join(tempRoot, 'forced', 'README.md'), 'hand edited');

    await created('forced', { frontend: 'react-ts', force: true });

    expect(read('forced', 'precious.txt')).toBe('mine');
    expect(read('forced', 'README.md')).toContain('# forced');
  });

});

describe('dry run: exact file set, nothing written', () => {
  const modes: Array<[string, Parameters<typeof createProject>[1]]> = [
    ['frontend', { frontend: 'react-ts' }],
    ['backend', { backend: 'express' }],
    ['fullstack', { fullstack: true }],
    ['skeleton', { template: 'blank' }],
    ['polyglot', { polyglot: true }],
    ['microfrontend', { microfrontend: true }],
  ];

  for (const [mode, options] of modes) {
    it(`${mode}: lists exactly the files the real run writes, and writes nothing`, async () => {
      const dry = await dryRun('exact', options);

      expect(createDryRunResponseSchema.safeParse(dry).success).toBe(true);
      expect(dry.mode).toBe(mode);
      expect(dry.dryRun).toBe(true);
      expect(dry.targetExists).toBe(false);
      expect(fs.readdirSync(tempRoot)).toEqual([]);
      expect(dry.files.every(f => f.status === 'added' && f.action === 'create')).toBe(true);
      expect(Object.keys(dry.previews).sort()).toEqual(dry.files.map(f => f.path).sort());
      expect(dry.totalBytes).toBe(dry.files.reduce((sum, f) => sum + f.bytes, 0));

      const real = await created('exact', options);
      expect([...real.files].sort()).toEqual(dry.files.map(f => f.path).sort());
      expect(dry.root).toBe(real.root);

      // And the bytes match what actually landed on disk.
      for (const file of dry.files) {
        expect(fs.statSync(path.join(tempRoot, file.path)).size, file.path).toBe(file.bytes);
      }
    });
  }

  it('previews carry the rendered content head, with the project name substituted', async () => {
    const dry = await dryRun('named-app', { backend: 'express' });
    const pkg = dry.previews['named-app/apps/named-app/package.json'];
    expect(pkg).toContain('named-app');
    expect(pkg).not.toContain('{{');
  });

  it('prints a human preview with counts and the file list', async () => {
    await dryRun('human', { frontend: 'react-ts' });
    expect(output()).toContain('Dry Run Preview');
    expect(output()).toContain('No files will be created.');
    expect(output()).toContain('Mode: frontend');
    expect(output()).toMatch(/\d+ files \(\d+ bytes\): \d+ added, 0 modified, 0 unchanged/);
    expect(output()).toContain('human/apps/human/package.json');
  });

  it('reports each file as added, modified or unchanged when the target already exists, with diffs', async () => {
    await created('exists', { frontend: 'react-ts' });
    const appJson = path.join(tempRoot, 'exists', 'apps', 'exists', 'package.json');
    const appTsx = path.join(tempRoot, 'exists', 'apps', 'exists', 'src', 'App.tsx');
    const edited = fs.readFileSync(appTsx, 'utf8').replace(/<h1>/, '<h1 data-edited="yes">');
    fs.writeFileSync(appTsx, edited);
    fs.removeSync(appJson);
    const snapshot = fs.readFileSync(appTsx, 'utf8');

    const dry = await dryRun('exists', { frontend: 'react-ts' });

    expect(dry.targetExists).toBe(true);
    const byPath = Object.fromEntries(dry.files.map(f => [f.path, f]));
    expect(byPath['exists/apps/exists/package.json']).toMatchObject({ status: 'added', action: 'create' });
    expect(byPath['exists/apps/exists/src/App.tsx']).toMatchObject({ status: 'modified', action: 'overwrite' });
    expect(byPath['exists/package.json']).toMatchObject({ status: 'unchanged', action: 'unchanged' });
    expect(dry.summary.added).toBe(1);
    expect(dry.summary.modified).toBe(1);
    expect(dry.summary.unchanged).toBe(dry.files.length - 2);

    // Unified diff, existing -> scaffolded, only on the modified file.
    const diff = byPath['exists/apps/exists/src/App.tsx'].diff ?? '';
    expect(diff).toContain('--- a/exists/apps/exists/src/App.tsx');
    expect(diff).toContain('+++ b/exists/apps/exists/src/App.tsx');
    expect(diff).toMatch(/^-.*data-edited="yes"/m);
    expect(diff).toMatch(/^\+.*<h1>/m);
    expect(dry.files.filter(f => f.diff).map(f => f.path)).toEqual(['exists/apps/exists/src/App.tsx']);
    expect(dry.notes.join('\n')).toContain('--force');

    // The dry run touched nothing.
    expect(fs.readFileSync(appTsx, 'utf8')).toBe(snapshot);
    expect(fs.existsSync(appJson)).toBe(false);
  });

  it('prints diffs for modified files in the human preview', async () => {
    await created('human-diff', { frontend: 'react-ts' });
    const readme = path.join(tempRoot, 'human-diff', 'README.md');
    fs.writeFileSync(readme, '# changed\n');
    logSpy.mockClear();

    await dryRun('human-diff', { frontend: 'react-ts' });
    expect(output()).toContain('Changes to existing files');
    expect(output()).toContain('--- a/human-diff/README.md');
    expect(output()).toContain('1 modified');
  });
});

describe('inside an existing monorepo', () => {
  it('frontend: scaffolds apps/<name> with the default route and registers it', async () => {
    stageMonorepo(true);
    const response = await created('web', { framework: 'react-ts', yes: true });

    expect(response.mode).toBe('frontend');
    expect(exists('apps', 'web', 'package.json')).toBe(true);
    expect(readJson('apps', 'web', 'package.json').reshell.route).toBe('/web');

    const registry = yaml.load(read('re-shell.workspaces.yaml')) as { services: Record<string, any> };
    expect(registry.services.web).toMatchObject({
      name: 'web',
      type: 'frontend',
      framework: 'react-ts',
      path: 'apps/web',
    });
    expect(response.files).toContain('re-shell.workspaces.yaml');
  });

  it('frontend: does not hang on the route prompt (stdin closed) and honours --route', async () => {
    stageMonorepo();
    await created('web', { framework: 'react-ts', route: '/custom' });
    expect(readJson('apps', 'web', 'package.json').reshell.route).toBe('/custom');
  });

  it('bare create inside a monorepo defaults to a react-ts frontend app', async () => {
    stageMonorepo();
    const response = await created('plain', {});
    expect(response.mode).toBe('frontend');
    expect(exists('apps', 'plain', 'package.json')).toBe(true);
  });

  it('backend-only: just the API under apps/<name>', async () => {
    stageMonorepo();
    const response = await created('svc', { backend: 'express' });
    expect(response.mode).toBe('backend');
    expect(exists('apps', 'svc', 'package.json')).toBe(true);
    expect(exists('services')).toBe(false);
    expect(exists('apps', 'svc', 'index.html')).toBe(false);
  });

  it('fullstack: frontend under apps/ and the API under services/<name>-api (separate packages)', async () => {
    stageMonorepo(true);
    const response = await created('shop', { fullstack: true });

    expect(response.mode).toBe('fullstack');
    const frontend = readJson('apps', 'shop', 'package.json');
    const api = readJson('services', 'shop-api', 'package.json');
    expect(frontend.name).toBe('@re-shell/shop');
    expect(api.name).toBe('shop-api');
    expect(frontend.dependencies.react).toBeDefined();
    expect(api.dependencies?.react).toBeUndefined();

    const registry = yaml.load(read('re-shell.workspaces.yaml')) as { services: Record<string, any> };
    expect(registry.services['shop'].path).toBe('apps/shop');
    expect(registry.services['shop-api']).toMatchObject({ type: 'backend', path: 'services/shop-api' });
  });

  it('--type routes to packages/ libs/ tools/', async () => {
    stageMonorepo();
    await created('shared', { type: 'lib', framework: 'react-ts' });
    expect(exists('libs', 'shared', 'package.json')).toBe(true);
  });

  it('refuses an existing workspace directory without --force, overwrites with it', async () => {
    stageMonorepo();
    await created('web', { framework: 'react-ts' });
    fs.writeFileSync(path.join(tempRoot, 'apps', 'web', 'keep.txt'), 'mine');

    expect((await errorOf(createProject('web', { framework: 'react-ts' }))).code).toBe('CREATE_TARGET_EXISTS');
    expect(fs.readFileSync(path.join(tempRoot, 'apps', 'web', 'keep.txt'), 'utf8')).toBe('mine');

    await created('web', { framework: 'react-ts', force: true });
    expect(fs.readFileSync(path.join(tempRoot, 'apps', 'web', 'keep.txt'), 'utf8')).toBe('mine');
  });

  it('a stack that needs a human decision fails with CREATE_INPUT_REQUIRED unless --force', async () => {
    stageMonorepo();
    hoisted.compatibility = {
      valid: false,
      compatibility: 'incompatible',
      warnings: ['mismatch'],
      suggestions: [],
    };

    const error = await errorOf(createProject('risky', { fullstack: true }));
    expect(error.code).toBe('CREATE_INPUT_REQUIRED');
    expect(error.message).toContain('--force');
    expect(exists('apps', 'risky')).toBe(false);

    const forced = await created('risky', { fullstack: true, force: true });
    expect(forced.mode).toBe('fullstack');
    expect(exists('apps', 'risky', 'package.json')).toBe(true);
  });

  it('a dry run records the blocker as a note instead of failing', async () => {
    stageMonorepo();
    hoisted.compatibility = {
      valid: false,
      compatibility: 'incompatible',
      warnings: ['mismatch'],
      suggestions: [],
    };
    const dry = await dryRun('risky', { fullstack: true });
    expect(dry.notes.join('\n')).toMatch(/not recommended.*unless --force/);
    expect(exists('apps', 'risky')).toBe(false);
  });

  it('dry run marks the workspace registry as modified (with a diff) when it exists', async () => {
    stageMonorepo(true);
    const before = read('re-shell.workspaces.yaml');

    const dry = await dryRun('web', { framework: 'react-ts' });

    const registry = dry.files.find(f => f.path === 're-shell.workspaces.yaml');
    expect(registry).toMatchObject({ status: 'modified', action: 'overwrite' });
    expect(registry?.diff).toContain('+  web:');
    expect(read('re-shell.workspaces.yaml')).toBe(before);
    expect(exists('apps', 'web')).toBe(false);
  });

  it('dry run lists exactly the files the real run writes (fullstack, with registry)', async () => {
    stageMonorepo(true);
    const dry = await dryRun('exact', { fullstack: true });
    const real = await created('exact', { fullstack: true });
    expect([...real.files].sort()).toEqual(dry.files.map(f => f.path).sort());
    expect(dry.files.some(f => f.path.startsWith('services/exact-api/'))).toBe(true);
    expect(dry.files.some(f => f.path.startsWith('apps/exact/'))).toBe(true);
  });
});
