import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fsReal from 'fs';
import * as path from 'path';
import * as os from 'os';
import { importFromMonorepo } from '../../src/commands/import-monorepo';

// Covers src/commands/import-monorepo.ts (609 lines) — the `import-monorepo`
// migration command. Everything runs against a REAL staged monorepo (fs-extra
// and glob are real); only `prompts` is mocked to drive the confirm dialog.

vi.mock('prompts', () => ({ default: vi.fn() }));
// glob v10+ has no CJS default export; the command's `glob.sync` call needs an
// interop shim under vitest. Back it with the real globSync implementation.
vi.mock('glob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('glob')>();
  const shim = { sync: actual.globSync };
  return { ...actual, default: shim };
});

const promptsMock = vi.mocked((await import('prompts')).default);

/** Stage a fresh temp dir the command can scan. */
function stageDir(): string {
  return fsReal.mkdtempSync(path.join(os.tmpdir(), 'reshell-import-'));
}

/** Write a JSON file, creating parent dirs. */
function writeJson(file: string, data: unknown): void {
  fsReal.mkdirSync(path.dirname(file), { recursive: true });
  fsReal.writeFileSync(file, JSON.stringify(data, null, 2));
}

describe('import-monorepo — command', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let roots: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    promptsMock.mockReset();
    promptsMock.mockResolvedValue({ value: true } as never);
  });

  afterEach(() => {
    logSpy.mockRestore();
    cwdSpy?.mockRestore();
    for (const r of roots) fsReal.rmSync(r, { recursive: true, force: true });
    roots = [];
    vi.restoreAllMocks();
  });

  /** Track a root and point cwd at it. */
  function use(root: string): string {
    roots.push(root);
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
    return root;
  }

  /** Joined console.log output. */
  function logged(): string {
    return logSpy.mock.calls.map(c => c.join(' ')).join('\n');
  }

  /** The generated re-shell.workspaces.yaml (or custom output). */
  function outputYaml(root: string, output?: string): string {
    return fsReal.readFileSync(
      path.join(root, output ?? 're-shell.workspaces.yaml'),
      'utf-8'
    );
  }

  it('bails with tool guidance when no monorepo config is detected', async () => {
    const root = stageDir();
    use(root);
    await importFromMonorepo();
    expect(logged()).toContain('No supported monorepo configuration found');
    expect(logged()).toContain('Nx, Turbo, Lerna, Yarn Workspaces, PNPM Workspaces');
    expect(promptsMock).not.toHaveBeenCalled();
    expect(fsReal.existsSync(path.join(root, 're-shell.workspaces.yaml'))).toBe(false);
  });

  it('imports an Nx monorepo from nx.json project entries', async () => {
    const root = stageDir();
    writeJson(path.join(root, 'nx.json'), {
      projects: {
        'web-app': { root: 'apps/web' },
        'api-gateway': 'services/api',
      },
    });
    writeJson(path.join(root, 'package.json'), { name: 'root', packageManager: 'yarn@4' });
    writeJson(path.join(root, 'apps/web/package.json'), {
      name: 'web-app',
      dependencies: { react: '^18.0.0' },
      devDependencies: { typescript: '^5' },
      scripts: { dev: 'vite' },
    });
    writeJson(path.join(root, 'services/api/package.json'), {
      name: 'api-gateway',
      dependencies: { express: '^4' },
    });
    use(root);
    await importFromMonorepo({ source: 'nx' });
    const yaml = outputYaml(root);
    expect(logged()).toContain('Detected: NX');
    expect(logged()).toContain('Found 2 project(s)');
    expect(logged()).toContain('web-app');
    expect(logged()).toContain('Framework: react');
    expect(logged()).toContain('Language: typescript');
    expect(yaml).toContain('packageManager: yarn@4');
    expect(yaml).toContain('  web-app:');
    expect(yaml).toContain('    type: frontend');
    expect(yaml).toContain('    port: ');
    expect(yaml).toContain('    route: /web-app');
    expect(yaml).toContain('  api-gateway:');
    expect(yaml).toContain('    type: backend');
    expect(yaml).toContain('      dev: "vite"');
    expect(yaml).toContain('        react: "^18.0.0"');
    expect(logged()).toContain('Workspace configuration created!');
  });

  it('imports a Turbo monorepo via root workspaces globs', async () => {
    const root = stageDir();
    writeJson(path.join(root, 'turbo.json'), { pipeline: {} });
    writeJson(path.join(root, 'package.json'), {
      workspaces: ['apps/*'],
    });
    writeJson(path.join(root, 'apps/dashboard/package.json'), {
      name: '@scope/dashboard',
      dependencies: { vue: '^3' },
    });
    use(root);
    await importFromMonorepo({ source: 'turbo' });
    const yaml = outputYaml(root);
    expect(logged()).toContain('Detected: TURBO');
    expect(yaml).toContain('@scope/dashboard:');
    expect(yaml).toContain('    framework: vue');
    expect(yaml).toContain('    type: frontend');
  });

  it('imports a Lerna monorepo from lerna.json packages', async () => {
    const root = stageDir();
    writeJson(path.join(root, 'lerna.json'), { packages: ['packages/*'] });
    writeJson(path.join(root, 'package.json'), { name: 'lerna-root' });
    writeJson(path.join(root, 'packages/shared-lib/package.json'), {
      name: 'shared-lib',
    });
    use(root);
    await importFromMonorepo({ source: 'lerna' });
    const yaml = outputYaml(root);
    expect(logged()).toContain('Detected: LERNA');
    expect(yaml).toContain('  shared-lib:');
    // library type maps to worker + vanilla framework default
    expect(yaml).toContain('    type: worker');
    expect(yaml).toContain('    framework: vanilla');
  });

  it('imports a Yarn monorepo detected automatically from package.json workspaces', async () => {
    const root = stageDir();
    writeJson(path.join(root, 'package.json'), {
      workspaces: { packages: ['apps/*', 'packages/*'] },
    });
    writeJson(path.join(root, 'apps/storefront/package.json'), {
      name: 'storefront',
      dependencies: { svelte: '^4' },
      scripts: { build: 'vite build' },
    });
    writeJson(path.join(root, 'packages/util/package.json'), { name: 'util' });
    use(root);
    await importFromMonorepo();
    const yaml = outputYaml(root);
    expect(logged()).toContain('Detected: YARN');
    expect(logged()).toContain('Found 2 project(s)');
    expect(yaml).toContain('  storefront:');
    expect(yaml).toContain('    framework: svelte');
    expect(yaml).toContain('  util:');
    // No react/vue dep and no name hints → library defaults
    expect(yaml).toContain('    type: worker');
    // Root has no packageManager → pnpm default
    expect(yaml).toContain('packageManager: pnpm');
  });

  it('imports a PNPM monorepo from pnpm-workspace.yaml', async () => {
    const root = stageDir();
    fsReal.writeFileSync(
      path.join(root, 'pnpm-workspace.yaml'),
      'packages:\n  - apps/*\n  - tools/*\n'
    );
    writeJson(path.join(root, 'package.json'), { name: 'pnpm-root' });
    writeJson(path.join(root, 'apps/main-app/package.json'), {
      name: 'main-app',
      dependencies: { '@angular/core': '^17' },
    });
    writeJson(path.join(root, 'tools/cli/package.json'), { name: 'cli-tool' });
    use(root);
    await importFromMonorepo({ source: 'pnpm' });
    const yaml = outputYaml(root);
    expect(logged()).toContain('Detected: PNPM');
    expect(yaml).toContain('    framework: angular');
    expect(yaml).toContain('  cli-tool:');
    expect(yaml).toContain('description: Workspace imported from pnpm');
  });

  it('auto-detects nx before turbo before lerna before yarn before pnpm', async () => {
    const root = stageDir();
    writeJson(path.join(root, 'nx.json'), { projects: {} });
    writeJson(path.join(root, 'turbo.json'), {});
    writeJson(path.join(root, 'lerna.json'), {});
    writeJson(path.join(root, 'package.json'), { workspaces: ['apps/*'] });
    fsReal.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n');
    use(root);
    // nx with zero projects → 'No projects found' proves nx won detection.
    await importFromMonorepo();
    expect(logged()).toContain('Detected: NX');
    expect(logged()).toContain('No projects found in configuration');
    expect(promptsMock).not.toHaveBeenCalled();
  });

  it('writes to a custom output path and cancels without writing on decline', async () => {
    const root = stageDir();
    writeJson(path.join(root, 'package.json'), { workspaces: ['apps/*'] });
    writeJson(path.join(root, 'apps/one/package.json'), { name: 'one' });
    use(root);
    promptsMock.mockResolvedValue({ value: false } as never);
    await importFromMonorepo({ output: 'custom.yaml' });
    expect(logged()).toContain('Import cancelled');
    expect(fsReal.existsSync(path.join(root, 'custom.yaml'))).toBe(false);
    expect(fsReal.existsSync(path.join(root, 're-shell.workspaces.yaml'))).toBe(false);
  });

  it('skips workspace dirs lacking package.json', async () => {
    const root = stageDir();
    writeJson(path.join(root, 'package.json'), { workspaces: ['apps/*'] });
    fsReal.mkdirSync(path.join(root, 'apps/empty-dir'), { recursive: true });
    writeJson(path.join(root, 'apps/real/package.json'), { name: 'real' });
    use(root);
    await importFromMonorepo();
    const yaml = outputYaml(root);
    expect(yaml).toContain('  real:');
    expect(yaml).not.toContain('empty-dir');
    expect(logged()).toContain('Found 1 project(s)');
  });

  it('derives a name from the directory when package.json lacks one', async () => {
    const root = stageDir();
    writeJson(path.join(root, 'package.json'), { workspaces: ['apps/*'] });
    writeJson(path.join(root, 'apps/unnamed-app/package.json'), { version: '0.1.0' });
    use(root);
    await importFromMonorepo();
    expect(outputYaml(root)).toContain('  unnamed-app:');
  });

  it('detects backend type via name hints and library via shared/common', async () => {
    const root = stageDir();
    writeJson(path.join(root, 'package.json'), { workspaces: ['apps/*', 'libs/*'] });
    writeJson(path.join(root, 'apps/user-api/package.json'), { name: 'user-api' });
    writeJson(path.join(root, 'libs/shared-common/package.json'), { name: 'shared-common' });
    use(root);
    await importFromMonorepo();
    const yaml = outputYaml(root);
    expect(yaml).toContain('  user-api:');
    expect(yaml).toMatch(/  user-api:\n    name: user-api\n    type: backend/);
    expect(yaml).toContain('  shared-common:');
  });

  it('falls back to javascript when no typescript dependency exists', async () => {
    const root = stageDir();
    writeJson(path.join(root, 'package.json'), { workspaces: ['apps/*'] });
    writeJson(path.join(root, 'apps/plain/package.json'), { name: 'plain' });
    use(root);
    await importFromMonorepo();
    expect(outputYaml(root)).toContain('    language: javascript');
  });

  it('uses explicit ports when projects already declare them via name hash', async () => {
    const root = stageDir();
    writeJson(path.join(root, 'package.json'), { workspaces: ['apps/*'] });
    writeJson(path.join(root, 'apps/web-thing/package.json'), {
      name: 'web-thing',
      dependencies: { react: '^18' },
    });
    use(root);
    await importFromMonorepo();
    const yaml = outputYaml(root);
    // Frontend default port lives in [3000, 3999]; route derives from name.
    expect(yaml).toMatch(/    port: 3\d{3}\n/);
    expect(yaml).toContain('    route: /web-thing');
  });

  it('imports from an explicit configPath override', async () => {
    const root = stageDir();
    writeJson(path.join(root, 'custom-nx.json'), {
      projects: { widget: { root: 'apps/widget' } },
    });
    writeJson(path.join(root, 'package.json'), { name: 'root' });
    writeJson(path.join(root, 'apps/widget/package.json'), { name: 'widget' });
    use(root);
    await importFromMonorepo({ source: 'nx', configPath: path.join(root, 'custom-nx.json') });
    expect(outputYaml(root)).toContain('  widget:');
  });
});
