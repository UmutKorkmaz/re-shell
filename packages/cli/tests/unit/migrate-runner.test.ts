import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  resolveCandidateTargets,
  applyRecipeToFile,
  backupFile,
  defaultAstGrepRunner,
  type AstGrepRunner,
  type PackageDir,
} from '../../src/utils/migrate-runner';
import {
  BUILT_IN_RECIPES,
  type MigrationRecipe,
} from '../../src/utils/migrate-engine';
import * as yaml from 'js-yaml';

/**
 * IO-layer coverage for `re-shell migrate`:
 *
 *   - target resolution across repo root + package dirs (topological order),
 *   - recipe application: read → transform → backup `.bak` → write,
 *   - ast-grep degrades to `skipped` when the binary is missing (ENOENT), and
 *     surfaces `failed` on a real runner error.
 *
 * All filesystem access is confined to temp directories that are torn down
 * after each test. No real ast-grep binary is required.
 */

const RECIPE = BUILT_IN_RECIPES.find(r => r.id === 'workspace-v1-to-v2')!;

/** Create a temp dir, write files into it (relative paths), return the dir. */
function makeTempDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-migrate-runner-'));
  for (const [name, content] of Object.entries(files)) {
    const fullPath = path.join(dir, name);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }
  return dir;
}

const TEMP_DIRS: string[] = [];
afterEach(() => {
  for (const d of TEMP_DIRS.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function tmp(files: Record<string, string>): string {
  const d = makeTempDir(files);
  TEMP_DIRS.push(d);
  return d;
}

describe('resolveCandidateTargets', () => {
  /** realpath resolves macOS /var → /private/var; compare on canonical paths. */
  function real(p: string): string {
    return fs.realpathSync(p);
  }

  it('resolves a matching v1 config at the repo root', () => {
    const dir = tmp({ 're-shell.workspaces.yaml': 'apps:\n  web:\n    path: apps/web\n' });
    const resolved = resolveCandidateTargets(RECIPE, dir, []);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].path).toBe(real(path.join(dir, 're-shell.workspaces.yaml')));
    expect(resolved[0].doc['apps']).toBeDefined();
  });

  it('skips a v2 config that does not match', () => {
    const dir = tmp({
      're-shell.workspaces.yaml': 'version: "2.0.0"\nservices: {}\n',
    });
    const resolved = resolveCandidateTargets(RECIPE, dir, []);
    expect(resolved).toHaveLength(0);
  });

  it('skips an unparseable YAML file', () => {
    const dir = tmp({ 're-shell.workspaces.yaml': ':\n  :  bad yaml  :\n   [' });
    const resolved = resolveCandidateTargets(RECIPE, dir, []);
    expect(resolved).toHaveLength(0);
  });

  it('resolves targets across package dirs in the given (topological) order', () => {
    const root = tmp({
      're-shell.workspaces.yaml': 'apps:\n  root:\n    path: .\n',
    });
    // Create a sub-package dir with its own v1 config.
    const pkgDir = path.join(root, 'packages', 'cli');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 're-shell.workspaces.yaml'),
      'apps:\n  pkg:\n    path: .\n',
      'utf8'
    );

    const packages: PackageDir[] = [{ name: '@rs/cli', dir: pkgDir }];
    const resolved = resolveCandidateTargets(RECIPE, root, packages);
    expect(resolved).toHaveLength(2);
    // Root is checked first, then packages (paths are canonical/realpath-resolved).
    expect(resolved[0].path).toBe(real(path.join(root, 're-shell.workspaces.yaml')));
    expect(resolved[1].path).toBe(real(path.join(pkgDir, 're-shell.workspaces.yaml')));
  });

  it('deduplicates the same file reached via multiple dirs', () => {
    const root = tmp({ 're-shell.workspaces.yaml': 'apps:\n  web: {}\n' });
    // A package dir that is actually the root itself (degenerate but possible).
    const packages: PackageDir[] = [{ name: 'root', dir: root }];
    const resolved = resolveCandidateTargets(RECIPE, root, packages);
    expect(resolved).toHaveLength(1);
  });

  it('deduplicates a symlinked package dir pointing at the root (realpath collapse)', () => {
    const root = tmp({ 're-shell.workspaces.yaml': 'apps:\n  web: {}\n' });
    // Create a symlink under packages/ that points back at the root, so the
    // same physical config file is reachable via two distinct dir strings.
    const linkDir = path.join(root, 'packages', 'link');
    fs.mkdirSync(path.dirname(linkDir), { recursive: true });
    fs.symlinkSync(root, linkDir, 'dir');
    const packages: PackageDir[] = [{ name: 'link', dir: linkDir }];
    const resolved = resolveCandidateTargets(RECIPE, root, packages);
    // The symlink collapses to the same realpath as the root entry — exactly ONE.
    expect(resolved).toHaveLength(1);
  });
});

describe('applyRecipeToFile (yaml kind)', () => {
  it('rewrites a v1 config to v2 and writes the result', async () => {
    const dir = tmp({ 're-shell.workspaces.yaml': 'apps:\n  web:\n    path: apps/web\n' });
    const file = path.join(dir, 're-shell.workspaces.yaml');

    const result = await applyRecipeToFile(RECIPE, file);
    expect(result.outcome).toBe('applied');
    expect(result.warnings).toEqual([]);

    const written = yaml.load(
      fs.readFileSync(file, 'utf8')
    ) as Record<string, unknown>;
    expect(written['version']).toBe('2.0.0');
    expect(written['apps']).toBeUndefined();
    expect(written['services']).toBeDefined();
  });

  it('writes a .bak backup before rewriting', async () => {
    const original = 'apps:\n  web:\n    path: apps/web\n';
    const dir = tmp({ 're-shell.workspaces.yaml': original });
    const file = path.join(dir, 're-shell.workspaces.yaml');

    await applyRecipeToFile(RECIPE, file);

    const backup = `${file}.bak`;
    expect(fs.existsSync(backup)).toBe(true);
    expect(fs.readFileSync(backup, 'utf8')).toBe(original);
  });

  it('returns skipped for an unparseable file', async () => {
    const dir = tmp({ 're-shell.workspaces.yaml': ':\n  : bad [' });
    const file = path.join(dir, 're-shell.workspaces.yaml');
    const result = await applyRecipeToFile(RECIPE, file);
    expect(result.outcome).toBe('skipped');
  });

  it('returns failed when the target file does not exist', async () => {
    const result = await applyRecipeToFile(RECIPE, '/nonexistent/path/x.yaml');
    expect(result.outcome).toBe('failed');
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('backupFile', () => {
  it('writes the provided content buffer to <file>.bak (no second disk read)', () => {
    const dir = tmp({ 'config.yaml': 'on-disk content\n' });
    const file = path.join(dir, 'config.yaml');
    // The backup must capture the EXACT buffer passed in, not re-read disk.
    backupFile(file, 'the transformed-from buffer\n');
    expect(fs.readFileSync(`${file}.bak`, 'utf8')).toBe('the transformed-from buffer\n');
  });
});

describe('applyRecipeToFile (ast-grep kind)', () => {
  /** A recipe that requires ast-grep. */
  const astRecipe: MigrationRecipe = {
    id: 'ast-test',
    fromVersionRange: '1.x',
    toVersion: '2.0.0',
    kind: 'ast-grep',
    title: 'ast',
    description: 'ast',
    targetFile: 'src/index.ts',
    matches: () => true,
    transform: d => d,
    astGrep: { pattern: 'console.log($A)', rewrite: 'logger.info($A)' },
  };

  it('degrades to skipped when the runner throws ENOENT (binary missing)', async () => {
    const dir = tmp({ 'src/index.ts': "console.log('hi')\n" });
    const file = path.join(dir, 'src/index.ts');

    const enoentRunner: AstGrepRunner = async () => {
      const err: NodeJS.ErrnoException = new Error('not found');
      err.code = 'ENOENT';
      throw err;
    };

    const result = await applyRecipeToFile(astRecipe, file, enoentRunner);
    expect(result.outcome).toBe('skipped');
    expect(result.warnings.join(' ')).toMatch(/ast-grep not installed/);
  });

  it('returns failed on a non-ENOENT runner error', async () => {
    const dir = tmp({ 'src/index.ts': "console.log('hi')\n" });
    const file = path.join(dir, 'src/index.ts');

    const errorRunner: AstGrepRunner = async () => {
      throw new Error('syntax error in pattern');
    };

    const result = await applyRecipeToFile(astRecipe, file, errorRunner);
    expect(result.outcome).toBe('failed');
  });

  it('returns skipped when an ast-grep recipe has no pattern spec', async () => {
    const noSpec: MigrationRecipe = {
      id: 'ast-no-spec',
      fromVersionRange: '1.x',
      toVersion: '2.0.0',
      kind: 'ast-grep',
      title: 'x',
      description: 'x',
      targetFile: 'src/index.ts',
      matches: () => true,
      transform: d => d,
    };
    const dir = tmp({ 'src/index.ts': 'x = 1\n' });
    const result = await applyRecipeToFile(noSpec, path.join(dir, 'src/index.ts'));
    expect(result.outcome).toBe('skipped');
  });

  it('reports applied when the injected runner succeeds', async () => {
    const dir = tmp({ 'src/index.ts': "console.log('hi')\n" });
    const file = path.join(dir, 'src/index.ts');
    const okRunner: AstGrepRunner = async () => '';
    const result = await applyRecipeToFile(astRecipe, file, okRunner);
    expect(result.outcome).toBe('applied');
  });
});

describe('defaultAstGrepRunner', () => {
  it('is an injectable function reference (not invoked here)', () => {
    // The default runner shells out to the real ast-grep binary; we only assert
    // it is a callable function so the injectable contract holds.
    expect(typeof defaultAstGrepRunner).toBe('function');
  });
});
