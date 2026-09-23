import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import YAML from 'yaml';
import {
  DEFAULT_MONOREPO_STRUCTURE,
  initializeMonorepo,
  getWorkspaces,
  isMonorepoRoot,
  findMonorepoRoot,
} from '../../src/utils/monorepo';

const TMP_BASE = path.join(os.tmpdir(), 'reshell-monorepo-test');

let tmpRoot: string;
let originalCwd: typeof process.cwd;

function makeTmp(): string {
  const dir = path.join(TMP_BASE, `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirpSync(dir);
  return dir;
}

function withCwd(dir: string, fn: () => Promise<void>): Promise<void> {
  const prev = process.cwd;
  try {
    Object.defineProperty(process, 'cwd', { value: () => dir, configurable: true });
    return fn().finally(() => {
      Object.defineProperty(process, 'cwd', { value: prev, configurable: true });
    });
  } catch {
    Object.defineProperty(process, 'cwd', { value: prev, configurable: true });
    return fn();
  }
}

beforeEach(() => {
  tmpRoot = makeTmp();
  originalCwd = process.cwd;
});

afterEach(() => {
  Object.defineProperty(process, 'cwd', { value: originalCwd, configurable: true });
  fs.removeSync(tmpRoot);
});

describe('DEFAULT_MONOREPO_STRUCTURE', () => {
  it('exposes the expected default directory names', () => {
    expect(DEFAULT_MONOREPO_STRUCTURE).toEqual({
      apps: 'apps',
      packages: 'packages',
      libs: 'libs',
      tools: 'tools',
      docs: 'docs',
    });
  });

  it('has exactly 5 keys', () => {
    expect(Object.keys(DEFAULT_MONOREPO_STRUCTURE)).toHaveLength(5);
  });
});

describe('initializeMonorepo', () => {
  it('creates the project directory with apps subdirectory', async () => {
    await withCwd(tmpRoot, async () => {
      const config = await initializeMonorepo('my-mono');
      const projectPath = path.join(tmpRoot, 'my-mono');
      expect(fs.existsSync(projectPath)).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'apps'))).toBe(true);
      expect(config.name).toBe('my-mono');
    });
  });

  it('returns a MonorepoConfig with the default structure', async () => {
    await withCwd(tmpRoot, async () => {
      const config = await initializeMonorepo('demo');
      expect(config.packageManager).toBe('pnpm');
      expect(config.structure).toEqual(DEFAULT_MONOREPO_STRUCTURE);
      expect(config.workspaces).toEqual([
        'apps/*',
        'packages/*',
        'libs/*',
        'tools/*',
      ]);
    });
  });

  it('writes a root package.json with the correct name and private flag', async () => {
    await withCwd(tmpRoot, async () => {
      await initializeMonorepo('pkg-test');
      const pkgJson = fs.readJsonSync(path.join(tmpRoot, 'pkg-test', 'package.json'));
      expect(pkgJson.name).toBe('pkg-test');
      expect(pkgJson.private).toBe(true);
      expect(pkgJson.version).toBe('0.1.0');
    });
  });

  it('writes pnpm-workspace.yaml when packageManager is pnpm', async () => {
    await withCwd(tmpRoot, async () => {
      await initializeMonorepo('pnpm-mono', 'pnpm');
      const yamlPath = path.join(tmpRoot, 'pnpm-mono', 'pnpm-workspace.yaml');
      expect(fs.existsSync(yamlPath)).toBe(true);
      const parsed = YAML.parse(fs.readFileSync(yamlPath, 'utf8'));
      expect(parsed.packages).toEqual(['apps/*', 'packages/*', 'libs/*', 'tools/*']);
    });
  });

  it('does not write pnpm-workspace.yaml when packageManager is npm', async () => {
    await withCwd(tmpRoot, async () => {
      await initializeMonorepo('npm-mono', 'npm');
      expect(fs.existsSync(path.join(tmpRoot, 'npm-mono', 'pnpm-workspace.yaml'))).toBe(false);
    });
  });

  it('writes workspaces as an object form for npm', async () => {
    await withCwd(tmpRoot, async () => {
      await initializeMonorepo('npm-mono2', 'npm');
      const pkgJson = fs.readJsonSync(path.join(tmpRoot, 'npm-mono2', 'package.json'));
      expect(pkgJson.workspaces).toEqual({
        packages: ['apps/*', 'packages/*', 'libs/*', 'tools/*'],
      });
    });
  });

  it('writes workspaces as array form for yarn, with re-merged fields', async () => {
    await withCwd(tmpRoot, async () => {
      await initializeMonorepo('yarn-mono', 'yarn');
      const pkgJson = fs.readJsonSync(path.join(tmpRoot, 'yarn-mono', 'package.json'));
      expect(Array.isArray(pkgJson.workspaces)).toBe(true);
      expect(pkgJson.workspaces).toEqual(['apps/*', 'packages/*', 'libs/*', 'tools/*']);
    });
  });

  it('writes workspaces as array form for pnpm package.json', async () => {
    await withCwd(tmpRoot, async () => {
      await initializeMonorepo('pnpm-arr', 'pnpm');
      const pkgJson = fs.readJsonSync(path.join(tmpRoot, 'pnpm-arr', 'package.json'));
      expect(Array.isArray(pkgJson.workspaces)).toBe(true);
    });
  });

  it('writes a .gitignore file containing common entries', async () => {
    await withCwd(tmpRoot, async () => {
      await initializeMonorepo('gi-test');
      const gitignore = fs.readFileSync(path.join(tmpRoot, 'gi-test', '.gitignore'), 'utf8');
      expect(gitignore).toContain('node_modules/');
      expect(gitignore).toContain('dist/');
      expect(gitignore).toContain('.env');
      expect(gitignore).toContain('.DS_Store');
    });
  });

  it('merges customStructure overrides into the default structure', async () => {
    await withCwd(tmpRoot, async () => {
      const config = await initializeMonorepo('custom', 'pnpm', {
        apps: 'applications',
        libs: 'libraries',
      });
      expect(config.structure.apps).toBe('applications');
      expect(config.structure.libs).toBe('libraries');
      expect(config.structure.packages).toBe('packages');
      expect(config.workspaces).toContain('applications/*');
      expect(config.workspaces).toContain('libraries/*');
      expect(fs.existsSync(path.join(tmpRoot, 'custom', 'applications'))).toBe(true);
    });
  });

  it('populates scripts with workspace-related commands', async () => {
    await withCwd(tmpRoot, async () => {
      await initializeMonorepo('scripts-test');
      const pkgJson = fs.readJsonSync(path.join(tmpRoot, 'scripts-test', 'package.json'));
      expect(pkgJson.scripts['workspace:list']).toBe('re-shell workspace list');
      expect(pkgJson.scripts['workspace:graph']).toBe('re-shell workspace graph');
      expect(pkgJson.scripts['workspace:update']).toBe('re-shell workspace update');
      expect(pkgJson.scripts.dev).toContain('dev');
    });
  });

  it('adds @re-shell/cli devDependency', async () => {
    await withCwd(tmpRoot, async () => {
      await initializeMonorepo('dep-test');
      const pkgJson = fs.readJsonSync(path.join(tmpRoot, 'dep-test', 'package.json'));
      expect(pkgJson.devDependencies['@re-shell/cli']).toBeDefined();
    });
  });

  it('sets engines.node to >=16.0.0', async () => {
    await withCwd(tmpRoot, async () => {
      await initializeMonorepo('engine-test');
      const pkgJson = fs.readJsonSync(path.join(tmpRoot, 'engine-test', 'package.json'));
      expect(pkgJson.engines.node).toBe('>=16.0.0');
    });
  });
});

describe('getWorkspaces', () => {
  async function seedWorkspace(
    root: string,
    pkgName: string,
    relPath: string,
    overrides: Record<string, any> = {},
  ): Promise<void> {
    const abs = path.join(root, relPath);
    await fs.ensureDir(abs);
    await fs.writeJson(path.join(abs, 'package.json'), {
      name: pkgName,
      version: '1.2.3',
      ...overrides,
    });
  }

  async function seedRoot(root: string, workspaces: string[]): Promise<void> {
    await fs.writeJson(path.join(root, 'package.json'), {
      name: 'root',
      version: '1.0.0',
      private: true,
      workspaces,
    });
  }

  it('throws when package.json is missing from the root', async () => {
    const empty = makeTmp();
    await expect(getWorkspaces(empty)).rejects.toThrow('package.json not found');
    fs.removeSync(empty);
  });

  it('returns an empty array when no workspaces are configured', async () => {
    await seedRoot(tmpRoot, []);
    const ws = await getWorkspaces(tmpRoot);
    expect(ws).toEqual([]);
  });

  it('returns an empty array when workspaces are missing entirely', async () => {
    await fs.writeJson(path.join(tmpRoot, 'package.json'), {
      name: 'root',
      version: '1.0.0',
    });
    const ws = await getWorkspaces(tmpRoot);
    expect(ws).toEqual([]);
  });

  it('discovers workspace packages listed in workspaces array', async () => {
    await seedRoot(tmpRoot, ['apps/*', 'packages/*']);
    await seedWorkspace(tmpRoot, '@demo/web', 'apps/web');
    await seedWorkspace(tmpRoot, '@demo/utils', 'packages/utils');
    const ws = await getWorkspaces(tmpRoot);
    expect(ws).toHaveLength(2);
    const names = ws.map(w => w.name).sort();
    expect(names).toEqual(['@demo/utils', '@demo/web']);
  });

  it('supports npm-style workspaces.packages object form', async () => {
    await fs.writeJson(path.join(tmpRoot, 'package.json'), {
      name: 'root',
      version: '1.0.0',
      workspaces: { packages: ['libs/*'] },
    });
    await seedWorkspace(tmpRoot, '@demo/lib1', 'libs/lib1');
    const ws = await getWorkspaces(tmpRoot);
    expect(ws).toHaveLength(1);
    expect(ws[0].name).toBe('@demo/lib1');
  });

  it('reads workspace patterns from pnpm-workspace.yaml when present', async () => {
    await fs.writeJson(path.join(tmpRoot, 'package.json'), {
      name: 'root',
      version: '1.0.0',
      workspaces: ['apps/*'],
    });
    await fs.writeFile(
      path.join(tmpRoot, 'pnpm-workspace.yaml'),
      YAML.stringify({ packages: ['tools/*'] }),
    );
    await seedWorkspace(tmpRoot, '@demo/tool1', 'tools/tool1');
    await seedWorkspace(tmpRoot, '@demo/app1', 'apps/app1');
    const ws = await getWorkspaces(tmpRoot);
    // pnpm-workspace.yaml overrides package.json workspaces
    expect(ws).toHaveLength(1);
    expect(ws[0].name).toBe('@demo/tool1');
  });

  it('infers workspace type from parent directory', async () => {
    await seedRoot(tmpRoot, ['apps/*', 'packages/*', 'libs/*', 'tools/*']);
    await seedWorkspace(tmpRoot, 'a', 'apps/app1');
    await seedWorkspace(tmpRoot, 'p', 'packages/pkg1');
    await seedWorkspace(tmpRoot, 'l', 'libs/lib1');
    await seedWorkspace(tmpRoot, 't', 'tools/tool1');
    const ws = await getWorkspaces(tmpRoot);
    const byName = Object.fromEntries(ws.map(w => [w.name, w.type]));
    expect(byName.a).toBe('app');
    expect(byName.p).toBe('package');
    expect(byName.l).toBe('lib');
    expect(byName.t).toBe('tool');
  });

  it('detects react-ts framework from dependencies', async () => {
    await seedRoot(tmpRoot, ['apps/*']);
    await seedWorkspace(tmpRoot, 'react-app', 'apps/ra', {
      dependencies: { react: '^18.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    });
    const ws = await getWorkspaces(tmpRoot);
    expect(ws[0].framework).toBe('react-ts');
  });

  it('detects react (no TS) framework', async () => {
    await seedRoot(tmpRoot, ['apps/*']);
    await seedWorkspace(tmpRoot, 'react-js', 'apps/rj', {
      dependencies: { react: '^18.0.0' },
    });
    const ws = await getWorkspaces(tmpRoot);
    expect(ws[0].framework).toBe('react');
  });

  it('detects vue-ts framework', async () => {
    await seedRoot(tmpRoot, ['apps/*']);
    await seedWorkspace(tmpRoot, 'vue-app', 'apps/va', {
      dependencies: { vue: '^3.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    });
    const ws = await getWorkspaces(tmpRoot);
    expect(ws[0].framework).toBe('vue-ts');
  });

  it('detects svelte framework (no TS)', async () => {
    await seedRoot(tmpRoot, ['apps/*']);
    await seedWorkspace(tmpRoot, 'sv-app', 'apps/sv', {
      dependencies: { svelte: '^4.0.0' },
    });
    const ws = await getWorkspaces(tmpRoot);
    expect(ws[0].framework).toBe('svelte');
  });

  it('detects angular framework', async () => {
    await seedRoot(tmpRoot, ['apps/*']);
    await seedWorkspace(tmpRoot, 'ng-app', 'apps/ng', {
      dependencies: { '@angular/core': '^17.0.0' },
    });
    const ws = await getWorkspaces(tmpRoot);
    expect(ws[0].framework).toBe('angular');
  });

  it('returns undefined framework when no known framework is present', async () => {
    await seedRoot(tmpRoot, ['packages/*']);
    await seedWorkspace(tmpRoot, 'plain', 'packages/pl', {
      dependencies: { lodash: '^4.0.0' },
    });
    const ws = await getWorkspaces(tmpRoot);
    expect(ws[0].framework).toBeUndefined();
  });

  it('combines dependencies and devDependencies into the dependencies list', async () => {
    await seedRoot(tmpRoot, ['packages/*']);
    await seedWorkspace(tmpRoot, 'deps-pkg', 'packages/dp', {
      dependencies: { react: '^18.0.0', lodash: '^4.0.0' },
      devDependencies: { vitest: '^1.0.0' },
    });
    const ws = await getWorkspaces(tmpRoot);
    expect(ws[0].dependencies).toEqual(expect.arrayContaining(['react', 'lodash', 'vitest']));
    expect(ws[0].dependencies).toHaveLength(3);
  });

  it('falls back to directory basename when package name is missing', async () => {
    await seedRoot(tmpRoot, ['apps/*']);
    const abs = path.join(tmpRoot, 'apps', 'noname');
    await fs.ensureDir(abs);
    await fs.writeJson(path.join(abs, 'package.json'), { version: '0.0.0' });
    const ws = await getWorkspaces(tmpRoot);
    expect(ws[0].name).toBe('noname');
  });

  it('falls back to version 0.0.0 when version is missing', async () => {
    await seedRoot(tmpRoot, ['apps/*']);
    const abs = path.join(tmpRoot, 'apps', 'noversion');
    await fs.ensureDir(abs);
    await fs.writeJson(path.join(abs, 'package.json'), { name: 'nv' });
    const ws = await getWorkspaces(tmpRoot);
    expect(ws[0].version).toBe('0.0.0');
  });

  it('skips glob matches that do not have a package.json', async () => {
    await seedRoot(tmpRoot, ['apps/*']);
    await fs.ensureDir(path.join(tmpRoot, 'apps', 'empty'));
    await seedWorkspace(tmpRoot, 'has-pkg', 'apps/has-pkg');
    const ws = await getWorkspaces(tmpRoot);
    expect(ws).toHaveLength(1);
    expect(ws[0].name).toBe('has-pkg');
  });

  it('stores the workspace path as the glob-relative match', async () => {
    await seedRoot(tmpRoot, ['apps/*']);
    await seedWorkspace(tmpRoot, 'p-test', 'apps/foo');
    const ws = await getWorkspaces(tmpRoot);
    expect(ws[0].path).toBe('apps/foo');
  });
});

describe('isMonorepoRoot', () => {
  it('returns false when no package.json exists', async () => {
    expect(await isMonorepoRoot(tmpRoot)).toBe(false);
  });

  it('returns false when package.json has no workspaces field', async () => {
    await fs.writeJson(path.join(tmpRoot, 'package.json'), { name: 'plain' });
    expect(await isMonorepoRoot(tmpRoot)).toBe(false);
  });

  it('returns true when package.json has a workspaces array', async () => {
    await fs.writeJson(path.join(tmpRoot, 'package.json'), {
      name: 'root',
      workspaces: ['apps/*'],
    });
    expect(await isMonorepoRoot(tmpRoot)).toBe(true);
  });

  it('returns true when package.json has a workspaces object', async () => {
    await fs.writeJson(path.join(tmpRoot, 'package.json'), {
      name: 'root',
      workspaces: { packages: ['apps/*'] },
    });
    expect(await isMonorepoRoot(tmpRoot)).toBe(true);
  });

  it('returns true when pnpm-workspace.yaml exists even without workspaces field', async () => {
    await fs.writeJson(path.join(tmpRoot, 'package.json'), { name: 'root' });
    await fs.writeFile(
      path.join(tmpRoot, 'pnpm-workspace.yaml'),
      YAML.stringify({ packages: ['apps/*'] }),
    );
    expect(await isMonorepoRoot(tmpRoot)).toBe(true);
  });

  it('returns false when package.json is invalid JSON', async () => {
    await fs.writeFile(path.join(tmpRoot, 'package.json'), '{ not valid json');
    expect(await isMonorepoRoot(tmpRoot)).toBe(false);
  });
});

describe('findMonorepoRoot', () => {
  it('returns the current directory when it is a monorepo root', async () => {
    await fs.writeJson(path.join(tmpRoot, 'package.json'), {
      name: 'root',
      workspaces: ['apps/*'],
    });
    const result = await findMonorepoRoot(tmpRoot);
    expect(result).toBe(path.resolve(tmpRoot));
  });

  it('walks up and finds the parent monorepo root', async () => {
    await fs.writeJson(path.join(tmpRoot, 'package.json'), {
      name: 'root',
      workspaces: ['apps/*'],
    });
    const nested = path.join(tmpRoot, 'apps', 'myapp', 'src');
    await fs.ensureDir(nested);
    const result = await findMonorepoRoot(nested);
    expect(result).toBe(path.resolve(tmpRoot));
  });

  it('returns null when no monorepo root exists up the tree', async () => {
    // tmpRoot has no package.json, and its parent (TMP_BASE or os.tmpdir()) likely
    // doesn't either. The walk should hit the filesystem root or depth limit.
    const nested = path.join(tmpRoot, 'a', 'b', 'c');
    await fs.ensureDir(nested);
    const result = await findMonorepoRoot(nested);
    expect(result).toBeNull();
  });

  it('resolves a relative start path to an absolute path', async () => {
    await fs.writeJson(path.join(tmpRoot, 'package.json'), {
      name: 'root',
      workspaces: ['apps/*'],
    });
    await withCwd(tmpRoot, async () => {
      const result = await findMonorepoRoot('.');
      expect(path.isAbsolute(result ?? '')).toBe(true);
      expect(result).toBe(path.resolve(tmpRoot));
    });
  });
});
