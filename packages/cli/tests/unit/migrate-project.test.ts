import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fsReal from 'fs';
import * as fsExtra from 'fs-extra';
import {
  importProject,
  exportProject,
  backupProject,
  restoreProject,
} from '../../src/commands/migrate-project';
import * as monorepo from '../../src/utils/monorepo';

// Covers src/commands/migrate-project.ts (576 lines) — the four
// `migrate-project` operations (import/export/backup/restore). All file
// operations run against real temp trees; findMonorepoRoot is spied so the
// "inside a monorepo" context can be staged or denied per test.

const TMP = fsReal.mkdtempSync(path.join(os.tmpdir(), 'reshell-migrate-'));

let logSpy: ReturnType<typeof vi.spyOn>;
let cwdSpy: ReturnType<typeof vi.spyOn>;
let findRootSpy: ReturnType<typeof vi.spyOn>;

function tmp(...parts: string[]): string {
  return path.join(TMP, ...parts);
}

/** Stage a standalone source project (react + yarn). */
function stageStandaloneSource(name = 'my-app'): string {
  const src = tmp('sources', name);
  fsExtra.ensureDirSync(src);
  fsExtra.writeJsonSync(path.join(src, 'package.json'), {
    name,
    dependencies: { react: '^18.2.0' },
    devDependencies: { typescript: '^5.0.0' },
    scripts: { dev: 'vite' },
  });
  fsReal.writeFileSync(path.join(src, 'yarn.lock'), '');
  fsExtra.ensureDirSync(path.join(src, 'src'));
  fsReal.writeFileSync(path.join(src, 'src', 'main.tsx'), 'export {}');
  return src;
}

/** Stage a monorepo source (workspaces + two package dirs). */
function stageMonorepoSource(): string {
  const src = tmp('sources', 'big-monorepo');
  fsExtra.ensureDirSync(src);
  fsExtra.writeJsonSync(path.join(src, 'package.json'), {
    name: 'big-monorepo',
    workspaces: ['packages/*'],
    private: true,
    scripts: { build: 'turbo build' },
  });
  for (const pkg of ['alpha', 'beta']) {
    const dir = path.join(src, 'packages', pkg);
    fsExtra.ensureDirSync(dir);
    fsExtra.writeJsonSync(path.join(dir, 'package.json'), { name: `@big/${pkg}` });
  }
  fsReal.writeFileSync(path.join(src, 'README.md'), '# big');
  return src;
}

/** Stage a Re-Shell monorepo and point findMonorepoRoot + cwd at it. */
function stageMonorepoRoot(name = 'shell-root'): string {
  const root = tmp('roots', name);
  fsExtra.ensureDirSync(path.join(root, 'apps'));
  fsExtra.ensureDirSync(path.join(root, 'packages'));
  fsExtra.writeJsonSync(path.join(root, 'package.json'), {
    name,
    private: true,
    workspaces: ['apps/*', 'packages/*'],
  });
  return root;
}

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmp('roots', 'shell-root'));
  findRootSpy = vi
    .spyOn(monorepo, 'findMonorepoRoot')
    .mockImplementation(async (p?: string) => tmp('roots', 'shell-root'));
});

afterEach(() => {
  logSpy.mockRestore();
  cwdSpy.mockRestore();
  findRootSpy.mockRestore();
  fsExtra.removeSync(tmp('targets'));
  fsExtra.removeSync(tmp('exports'));
  fsExtra.removeSync(tmp('backups'));
  fsExtra.removeSync(tmp('sources'));
  fsExtra.removeSync(tmp('roots'));
});

afterAll(() => {
  fsReal.rmSync(TMP, { recursive: true, force: true });
});

function out(): string {
  return logSpy.mock.calls.map(c => String(c[0])).join('\n');
}

describe('importProject', () => {
  it('rejects a missing source path', async () => {
    await expect(importProject(tmp('nowhere'))).rejects.toThrow('Source path does not exist');
  });

  it('rejects a source without package.json', async () => {
    const src = tmp('sources', 'empty');
    fsExtra.ensureDirSync(src);
    await expect(importProject(src)).rejects.toThrow('No package.json found');
  });

  it('imports a standalone project into apps/ with a scoped name', async () => {
    const root = stageMonorepoRoot();
    const src = stageStandaloneSource('my-app');

    await importProject(src, { verbose: true });

    const target = path.join(root, 'apps', 'my-app');
    const pkg = fsExtra.readJsonSync(path.join(target, 'package.json'));
    expect(pkg.name).toBe('@shell-root/my-app');
    expect(pkg.private).toBe(true);
    expect(fsReal.existsSync(path.join(target, 'src', 'main.tsx'))).toBe(true);

    // root workspaces gain the new entry
    const rootPkg = fsExtra.readJsonSync(path.join(root, 'package.json'));
    expect(rootPkg.workspaces).toContain('apps/my-app');

    const text = out();
    expect(text).toContain('Imported standalone project as workspace');
    expect(text).toContain('Project Analysis:');
    expect(text).toContain('react-ts');
    expect(text).toContain('yarn');
  });

  it('dry-runs a standalone import without writing files', async () => {
    stageMonorepoRoot();
    const src = stageStandaloneSource('dry-app');

    await importProject(src, { dryRun: true });

    expect(out()).toContain('DRY RUN - Would import standalone project');
    expect(fsReal.existsSync(tmp('roots', 'shell-root', 'apps', 'dry-app'))).toBe(false);
  });

  it('requires a Re-Shell monorepo for standalone imports', async () => {
    findRootSpy.mockResolvedValue(null);
    const src = stageStandaloneSource('orphan');

    await expect(importProject(src)).rejects.toThrow('Not in a Re-Shell monorepo');
  });

  it('imports a monorepo source and injects re-shell scripts', async () => {
    const src = stageMonorepoSource();

    await importProject(src, { verbose: true });

    const target = tmp('roots', 'shell-root', 'big-monorepo');
    const pkg = fsExtra.readJsonSync(path.join(target, 'package.json'));
    expect(pkg.devDependencies['@re-shell/cli']).toBe('latest');
    expect(pkg.scripts.dev).toBe('re-shell serve');
    expect(pkg.scripts.build).toBe('re-shell build');
    // both workspace packages copied over
    expect(fsReal.existsSync(path.join(target, 'packages', 'alpha', 'package.json'))).toBe(true);
    expect(fsReal.existsSync(path.join(target, 'packages', 'beta', 'package.json'))).toBe(true);
    expect(out()).toContain('Imported monorepo with 1 workspaces');
  });

  it('dry-runs a monorepo import without writing files', async () => {
    const src = stageMonorepoSource();
    await importProject(src, { dryRun: true });

    expect(out()).toContain('DRY RUN - Would import monorepo');
    expect(fsReal.existsSync(tmp('roots', 'shell-root', 'big-monorepo'))).toBe(false);
  });

  it('creates a backup next to the source when requested', async () => {
    stageMonorepoRoot();
    const src = stageStandaloneSource('backed');

    await importProject(src, { backup: true, verbose: true });

    const parent = path.dirname(src);
    const entries = fsReal.readdirSync(parent).filter(e => e.startsWith('backup-'));
    expect(entries.length).toBe(1);
    const manifest = fsExtra.readJsonSync(
      path.join(parent, entries[0], '.backup-manifest.json')
    );
    expect(manifest.source).toBe(src);
    expect(out()).toContain('Backup created');
  });

  it('fails the spinner and rethrows on error', async () => {
    const spinner = { text: '', succeed: vi.fn(), fail: vi.fn() };
    await expect(importProject(tmp('nowhere'), { spinner })).rejects.toThrow();
    expect(spinner.fail).toHaveBeenCalled();
  });

  it('reports the next steps after a successful import', async () => {
    stageMonorepoRoot();
    const src = stageStandaloneSource('steppy');
    await importProject(src);

    const text = out();
    expect(text).toContain('Next Steps:');
    expect(text).toContain('pnpm install');
    expect(text).toContain('re-shell doctor');
  });
});

describe('exportProject', () => {
  it('rejects when not inside a monorepo', async () => {
    findRootSpy.mockResolvedValue(null);
    await expect(exportProject(tmp('exports', 'out'))).rejects.toThrow(
      'Not in a Re-Shell monorepo'
    );
  });

  it('refuses to overwrite an existing target without force', async () => {
    stageMonorepoRoot();
    const target = tmp('exports', 'exists');
    fsExtra.ensureDirSync(target);

    await expect(exportProject(target)).rejects.toThrow('Target path already exists');
  });

  it('copies the monorepo structure and writes an export manifest', async () => {
    const root = stageMonorepoRoot();
    fsExtra.ensureDirSync(path.join(root, 'apps', 'web'));
    fsExtra.writeJsonSync(path.join(root, 'apps', 'web', 'package.json'), { name: 'web' });
    fsReal.writeFileSync(path.join(root, 'README.md'), '# shell');

    const target = tmp('exports', 'out');
    await exportProject(target, { verbose: true });

    expect(fsReal.existsSync(path.join(target, 'apps', 'web', 'package.json'))).toBe(true);
    expect(fsReal.existsSync(path.join(target, 'README.md'))).toBe(true);
    const manifest = fsExtra.readJsonSync(path.join(target, '.export-manifest.json'));
    expect(manifest.source).toBe(root);
    expect(manifest.tool).toBe('Re-Shell CLI');

    const text = out();
    expect(text).toContain('Export Complete');
    expect(text).toContain('Export created');
  });

  it('overwrites the target when force is set', async () => {
    stageMonorepoRoot();
    const target = tmp('exports', 'forced');
    fsExtra.ensureDirSync(target);
    fsReal.writeFileSync(path.join(target, 'stale.txt'), 'x');

    await exportProject(target, { force: true });

    const manifest = fsExtra.readJsonSync(path.join(target, '.export-manifest.json'));
    expect(manifest.version).toBe('1.0.0');
  });
});

describe('backupProject', () => {
  it('rejects when not inside a monorepo', async () => {
    findRootSpy.mockResolvedValue(null);
    await expect(backupProject()).rejects.toThrow('Not in a Re-Shell monorepo');
  });

  it('creates a timestamped backup beside the monorepo root', async () => {
    const root = stageMonorepoRoot();
    fsReal.writeFileSync(path.join(root, 'README.md'), '# shell');

    await backupProject({ verbose: true });

    const parent = path.dirname(root);
    const entries = fsReal.readdirSync(parent).filter(e => e.startsWith('re-shell-backup-'));
    expect(entries.length).toBe(1);
    const manifest = fsExtra.readJsonSync(
      path.join(parent, entries[0], '.backup-manifest.json')
    );
    expect(manifest.source).toBe(root);
    expect(out()).toContain('Backup created');
    expect(out()).toContain('Size:');
  });
});

describe('restoreProject', () => {
  function stageBackup(): string {
    const backup = tmp('backups', 'snap');
    fsExtra.ensureDirSync(path.join(backup, 'apps', 'web'));
    fsExtra.writeJsonSync(path.join(backup, 'package.json'), { name: 'restored' });
    fsReal.writeFileSync(path.join(backup, 'apps', 'web', 'index.js'), 'x');
    return backup;
  }

  it('rejects a missing backup path', async () => {
    await expect(restoreProject(tmp('nowhere'), tmp('targets', 'x'))).rejects.toThrow(
      'Backup path does not exist'
    );
  });

  it('refuses an existing target without force', async () => {
    const backup = stageBackup();
    const target = tmp('targets', 'busy');
    fsExtra.ensureDirSync(target);

    await expect(restoreProject(backup, target)).rejects.toThrow('Target path already exists');
  });

  it('restores the backup contents to the target', async () => {
    const backup = stageBackup();
    const target = tmp('targets', 'fresh');

    await restoreProject(backup, target);

    expect(fsReal.existsSync(path.join(target, 'apps', 'web', 'index.js'))).toBe(true);
    const pkg = fsExtra.readJsonSync(path.join(target, 'package.json'));
    expect(pkg.name).toBe('restored');
    expect(out()).toContain('Restore Complete');
    expect(out()).toContain('pnpm install');
  });
});

describe('analyzeProject detection (through import verbose output)', () => {
  it('detects npm as the fallback package manager and vanilla framework', async () => {
    stageMonorepoRoot();
    const src = tmp('sources', 'plain');
    fsExtra.ensureDirSync(src);
    fsExtra.writeJsonSync(path.join(src, 'package.json'), { name: 'plain' });

    await importProject(src, { verbose: true });

    const text = out();
    expect(text).toContain('Name: plain');
    expect(text).toContain('Framework: vanilla');
    expect(text).toContain('Package Manager: npm');
    expect(text).toContain('Type: standalone');
  });

  it('detects monorepo type from lerna.json even without workspaces field', async () => {
    const src = tmp('sources', 'lerny');
    fsExtra.ensureDirSync(src);
    fsExtra.writeJsonSync(path.join(src, 'package.json'), { name: 'lerny' });
    fsExtra.writeJsonSync(path.join(src, 'lerna.json'), { packages: ['custom/*'] });

    await importProject(src, { verbose: true, dryRun: true });

    const text = out();
    expect(text).toContain('Type: monorepo');
    expect(text).toContain('Workspaces: 1');
  });

  it('detects pnpm and bun from their lockfiles', async () => {
    stageMonorepoRoot();
    const src = tmp('sources', 'pn');
    fsExtra.ensureDirSync(src);
    fsExtra.writeJsonSync(path.join(src, 'package.json'), { name: 'pn' });
    fsReal.writeFileSync(path.join(src, 'pnpm-lock.yaml'), '');

    await importProject(src, { verbose: true, dryRun: true });
    expect(out()).toContain('Package Manager: pnpm');
    logSpy.mockClear();

    const src2 = tmp('sources', 'bunny');
    fsExtra.ensureDirSync(src2);
    fsExtra.writeJsonSync(path.join(src2, 'package.json'), { name: 'bunny' });
    fsReal.writeFileSync(path.join(src2, 'bun.lockb'), '');

    await importProject(src2, { verbose: true, dryRun: true });
    expect(out()).toContain('Package Manager: bun');
  });
});
