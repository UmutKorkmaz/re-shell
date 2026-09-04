import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  WorkspaceBackupManager,
  createWorkspaceBackupManager,
  createQuickBackup,
  compareBackups,
  type BackupContent,
} from '../../src/utils/workspace-backup';
import { createDefaultWorkspaceDefinition } from '../../src/utils/workspace-schema';

/**
 * Write a valid workspace definition file (built from the schema's own default
 * factory) into `root` and return its path, so `createBackup` has something to
 * load via `loadWorkspaceDefinition`.
 */
async function seedWorkspaceFile(root: string, name = 'test'): Promise<string> {
  const def = createDefaultWorkspaceDefinition(name);
  const file = path.join(root, `${name}.workspaces.yaml`);
  await fs.writeFile(file, yaml.stringify(def), 'utf8');
  return file;
}

/**
 * Build a fully-controlled backup payload for `importBackup`, bypassing
 * `loadWorkspaceDefinition` so workspace content (and thus `compareBackups`)
 * can be asserted precisely. The id is left falsy so the manager generates one.
 */
function craftBackup(over: { metadata?: Partial<BackupContent['metadata']>; workspace?: Partial<BackupContent['workspace']> } = {}): BackupContent {
  return {
    metadata: {
      id: '',
      name: 'crafted',
      timestamp: '2026-01-01T00:00:00.000Z',
      workspaceFile: 'test.workspaces.yaml',
      version: '1.0.0',
      size: 100,
      hash: 'deadbeef',
      ...over.metadata,
    },
    workspace: { workspaces: {}, ...over.workspace } as BackupContent['workspace'],
  };
}

describe('WorkspaceBackupManager — constructor + init', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-init-')); });
  afterEach(() => fs.removeSync(root));

  it('places the backup dir + index under <root>/.re-shell/backups', () => {
    const m = new WorkspaceBackupManager(root);
    expect((m as any).backupDir).toBe(path.join(root, '.re-shell', 'backups'));
    expect((m as any).indexPath).toBe(path.join(root, '.re-shell', 'backups', 'index.json'));
  });

  it('init creates the directory and persists a default index', async () => {
    const m = new WorkspaceBackupManager(root);
    await m.init();
    expect(await fs.pathExists((m as any).backupDir)).toBe(true);
    const index = await fs.readJson((m as any).indexPath);
    expect(index.version).toBe('1.0.0');
    expect(index.backups).toEqual({});
    expect(index.metadata.totalBackups).toBe(0);
  });

  it('defaults rootPath to the current working directory', () => {
    const m = new WorkspaceBackupManager();
    expect((m as any).rootPath).toBe(process.cwd());
  });
});

describe('WorkspaceBackupManager — createBackup', () => {
  let root: string;
  let workspaceFile: string;
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-create-'));
    workspaceFile = await seedWorkspaceFile(root);
  });
  afterEach(() => fs.removeSync(root));

  it('creates a backup, writes its file and registers it in the index', async () => {
    const m = new WorkspaceBackupManager(root);
    await m.init();
    const id = await m.createBackup(workspaceFile);

    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(await fs.pathExists(path.join((m as any).backupDir, `${id}.json`))).toBe(true);
    expect(await m.listBackups()).toHaveLength(1);

    const backup = await m.getBackup(id);
    expect(backup).not.toBeNull();
    expect(backup!.metadata.id).toBe(id);
    expect(backup!.metadata.workspaceFile).toBe('test.workspaces.yaml');
    expect(backup!.metadata.size).toBeGreaterThan(0);
    expect(backup!.metadata.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(backup!.workspace).toBeDefined();
  });

  it('reflects name, description and tags in the metadata', async () => {
    const m = new WorkspaceBackupManager(root);
    await m.init();
    const id = await m.createBackup(workspaceFile, {
      name: 'release-1',
      description: 'pre-release snapshot',
      tags: ['release', 'v1'],
    });
    const backup = await m.getBackup(id);
    expect(backup!.metadata).toMatchObject({
      name: 'release-1',
      description: 'pre-release snapshot',
      tags: ['release', 'v1'],
    });
  });

  it('captures cache and templates directories when requested', async () => {
    await fs.ensureDir(path.join(root, '.re-shell', 'cache'));
    await fs.writeFile(path.join(root, '.re-shell', 'cache', 'a.json'), '{}');
    await fs.ensureDir(path.join(root, '.re-shell', 'templates'));
    await fs.writeFile(path.join(root, '.re-shell', 'templates', 't.yaml'), 'x: 1');

    const m = new WorkspaceBackupManager(root);
    await m.init();
    const id = await m.createBackup(workspaceFile, { includeCache: true, includeTemplates: true });
    const backup = await m.getBackup(id);
    expect(backup!.cache).toBeDefined();
    expect(backup!.templates).toBeDefined();
    expect(backup!.metadata.includeCache).toBe(true);
    expect(backup!.metadata.includeTemplates).toBe(true);
  });

  it('captures matching project files when includeFiles is set', async () => {
    await fs.writeFile(path.join(root, 'pkg.json'), '{"name":"a"}');
    await fs.writeFile(path.join(root, 'notes.md'), '# notes');

    const m = new WorkspaceBackupManager(root);
    await m.init();
    const id = await m.createBackup(workspaceFile, { includeFiles: true, filePatterns: ['*.json'] });
    const backup = await m.getBackup(id);
    expect(backup!.files).toBeDefined();
    expect(Object.keys(backup!.files!)).toContain('pkg.json');
    expect(Object.keys(backup!.files!)).not.toContain('notes.md');
  });

  it('falls back to a date-stamped default name', async () => {
    const m = new WorkspaceBackupManager(root);
    await m.init();
    const id = await m.createBackup(workspaceFile);
    const backup = await m.getBackup(id);
    expect(backup!.metadata.name).toMatch(/^backup-\d{4}-\d{2}-\d{2}$/);
  });
});

describe('WorkspaceBackupManager — list / get / delete', () => {
  let root: string;
  let m: WorkspaceBackupManager;
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-crud-'));
    m = new WorkspaceBackupManager(root);
    await m.init();
  });
  afterEach(() => fs.removeSync(root));

  async function importCrafted(over: Parameters<typeof craftBackup>[0] = {}) {
    const file = path.join(root, 'seed.json');
    await fs.writeJson(file, craftBackup(over));
    return m.importBackup(file);
  }

  it('listBackups returns all entries and getBackup returns null for unknown ids', async () => {
    await importCrafted({ metadata: { name: 'a' } });
    await importCrafted({ metadata: { name: 'b' } });
    expect(await m.listBackups()).toHaveLength(2);
    expect(await m.getBackup('does-not-exist')).toBeNull();
  });

  it('deleteBackup removes the file and index entry', async () => {
    const id = await importCrafted();
    await m.deleteBackup(id);
    expect(await m.listBackups()).toHaveLength(0);
    expect(await fs.pathExists(path.join((m as any).backupDir, `${id}.json`))).toBe(false);
  });

  it('deleteBackup throws for an unknown id', async () => {
    await expect(m.deleteBackup('ghost')).rejects.toThrow(/not found/);
  });
});

describe('WorkspaceBackupManager — export / import', () => {
  let root: string;
  let m: WorkspaceBackupManager;
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-io-'));
    m = new WorkspaceBackupManager(root);
    await m.init();
  });
  afterEach(() => fs.removeSync(root));

  it('exportBackup writes the backup payload to an arbitrary path', async () => {
    const seedFile = path.join(root, 'seed.json');
    await fs.writeJson(seedFile, craftBackup({ metadata: { name: 'exp' } }));
    const id = await m.importBackup(seedFile);

    const out = path.join(root, 'out', 'exported.json');
    await m.exportBackup(id, out);
    const exported = await fs.readJson(out);
    expect(exported.metadata.name).toBe('exp');
  });

  it('exportBackup throws for an unknown id', async () => {
    await expect(m.exportBackup('ghost', path.join(root, 'x.json'))).rejects.toThrow(/not found/);
  });

  it('importBackup registers a valid file and generates an id when missing', async () => {
    const file = path.join(root, 'seed.json');
    await fs.writeJson(file, craftBackup({ metadata: { id: '' } }));
    const id = await m.importBackup(file);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(await m.getBackup(id)).not.toBeNull();
  });

  it('importBackup reuses a provided id', async () => {
    const file = path.join(root, 'seed.json');
    await fs.writeJson(file, craftBackup({ metadata: { id: 'fixed-id-123' } }));
    const id = await m.importBackup(file);
    expect(id).toBe('fixed-id-123');
  });

  it('importBackup rejects a missing file', async () => {
    await expect(m.importBackup(path.join(root, 'nope.json'))).rejects.toThrow(/not found/);
  });

  it('importBackup rejects a malformed payload', async () => {
    const file = path.join(root, 'bad.json');
    await fs.writeJson(file, { metadata: { id: 'x' } /* no workspace */ });
    await expect(m.importBackup(file)).rejects.toThrow(/Invalid backup file format/);
  });
});

describe('WorkspaceBackupManager — restoreBackup', () => {
  let root: string;
  let m: WorkspaceBackupManager;
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-restore-'));
    m = new WorkspaceBackupManager(root);
    await m.init();
  });
  afterEach(() => fs.removeSync(root));

  it('throws when the target workspace file already exists and force is not set', async () => {
    const seed = path.join(root, 'seed.json');
    await fs.writeJson(seed, craftBackup({ metadata: { workspaceFile: 'test.workspaces.yaml' } }));
    const id = await m.importBackup(seed);
    // Pre-create the target file so restore must refuse without force.
    await fs.writeFile(path.join(root, 'test.workspaces.yaml'), 'existing');

    await expect(m.restoreBackup(id)).rejects.toThrow(/already exists/);
  });

  it('overwrites the target file when force is set', async () => {
    const seed = path.join(root, 'seed.json');
    await fs.writeJson(
      seed,
      craftBackup({
        metadata: { workspaceFile: 'restored.yaml' },
        workspace: { workspaces: { web: { path: 'apps/web' } } } as any,
      }),
    );
    const id = await m.importBackup(seed);
    await fs.writeFile(path.join(root, 'restored.yaml'), 'old');

    await m.restoreBackup(id, { force: true });
    const restored = await fs.readFile(path.join(root, 'restored.yaml'), 'utf8');
    expect(restored).not.toBe('old');
    expect(yaml.parse(restored).workspaces.web.path).toBe('apps/web');
  });

  it('restores into a custom targetPath', async () => {
    const seed = path.join(root, 'seed.json');
    await fs.writeJson(seed, craftBackup({ metadata: { workspaceFile: 't.yaml' } }));
    const id = await m.importBackup(seed);

    const target = path.join(root, 'elsewhere');
    await m.restoreBackup(id, { targetPath: target, force: true });
    expect(await fs.pathExists(path.join(target, 't.yaml'))).toBe(true);
  });

  it('restores captured files when restoreFiles is set', async () => {
    const seed = path.join(root, 'seed.json');
    await fs.writeJson(
      seed,
      craftBackup({
        metadata: { workspaceFile: 't.yaml' },
      }),
    );
    // getBackup returns the raw content; splice files into the stored backup.
    const id = await m.importBackup(seed);
    const backup = await m.getBackup(id);
    backup!.files = { 'docs/readme.md': '# hello' };
    await fs.writeJson(path.join((m as any).backupDir, `${id}.json`), backup);

    await m.restoreBackup(id, { restoreFiles: true, force: true });
    expect(await fs.readFile(path.join(root, 'docs', 'readme.md'), 'utf8')).toBe('# hello');
  });

  it('throws for an unknown backup id', async () => {
    await expect(m.restoreBackup('ghost')).rejects.toThrow(/not found/);
  });
});

describe('WorkspaceBackupManager — cleanupBackups', () => {
  let root: string;
  let m: WorkspaceBackupManager;
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-cleanup-'));
    m = new WorkspaceBackupManager(root);
    await m.init();
  });
  afterEach(() => fs.removeSync(root));

  async function importStamped(ts: string, size = 100) {
    const file = path.join(root, `seed-${ts}.json`);
    await fs.writeJson(file, craftBackup({ metadata: { timestamp: ts, size } }));
    return m.importBackup(file);
  }

  it('keeps the newest N backups and deletes the rest (keepCount)', async () => {
    await importStamped('2026-01-01T00:00:00.000Z');
    await importStamped('2026-02-01T00:00:00.000Z');
    await importStamped('2026-03-01T00:00:00.000Z');

    const result = await m.cleanupBackups({ keepCount: 1 });
    expect(result.deletedCount).toBe(2);
    expect(await m.listBackups()).toHaveLength(1);
  });

  it('reports freed space as the sum of deleted backup sizes', async () => {
    await importStamped('2026-01-01T00:00:00.000Z', 100);
    await importStamped('2026-02-01T00:00:00.000Z', 200);
    await importStamped('2026-03-01T00:00:00.000Z', 300);

    const result = await m.cleanupBackups({ keepCount: 1 });
    // Newest (300) kept, two oldest (100 + 200) deleted.
    expect(result.freedSpace).toBe(300);
  });

  it('dryRun reports deletions without removing anything', async () => {
    await importStamped('2026-01-01T00:00:00.000Z');
    await importStamped('2026-02-01T00:00:00.000Z');

    const result = await m.cleanupBackups({ keepCount: 1, dryRun: true });
    expect(result.deletedCount).toBe(1);
    expect(await m.listBackups()).toHaveLength(2);
  });

  it('deletes backups older than keepDays', async () => {
    const old = new Date();
    old.setDate(old.getDate() - 30);
    await importStamped(old.toISOString());
    await importStamped(new Date().toISOString());

    const result = await m.cleanupBackups({ keepDays: 7 });
    expect(result.deletedCount).toBe(1);
    expect(await m.listBackups()).toHaveLength(1);
  });
});

describe('WorkspaceBackupManager — getBackupStatistics', () => {
  let root: string;
  let m: WorkspaceBackupManager;
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-stats-'));
    m = new WorkspaceBackupManager(root);
    await m.init();
  });
  afterEach(() => fs.removeSync(root));

  it('reports zeros and no names when there are no backups', () => {
    const stats = m.getBackupStatistics();
    expect(stats).toMatchObject({ totalBackups: 0, totalSize: 0, averageSize: 0 });
    expect(stats.oldestBackup).toBeUndefined();
    expect(stats.newestBackup).toBeUndefined();
  });

  it('aggregates counts, sizes and oldest/newest names', async () => {
    const file = path.join(root, 's1.json');
    await fs.writeJson(file, craftBackup({ metadata: { name: 'first', timestamp: '2026-01-01T00:00:00.000Z', size: 200 } }));
    await m.importBackup(file);
    await fs.writeJson(file, craftBackup({ metadata: { name: 'second', timestamp: '2026-02-01T00:00:00.000Z', size: 400 } }));
    await m.importBackup(file);

    const stats = m.getBackupStatistics();
    expect(stats.totalBackups).toBe(2);
    expect(stats.totalSize).toBe(600);
    expect(stats.averageSize).toBe(300);
    expect(stats.oldestBackup).toBe('first');
    expect(stats.newestBackup).toBe('second');
  });
});

describe('compareBackups', () => {
  let root: string;
  let m: WorkspaceBackupManager;
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-cmp-'));
    m = new WorkspaceBackupManager(root);
    await m.init();
  });
  afterEach(() => fs.removeSync(root));

  async function importWorkspaces(ws: Record<string, unknown>, ts = '2026-01-01T00:00:00.000Z') {
    const file = path.join(root, 'seed.json');
    await fs.writeJson(file, craftBackup({ metadata: { timestamp: ts }, workspace: { workspaces: ws } as any }));
    return m.importBackup(file);
  }

  it('classifies workspace keys as added, removed, modified and unchanged', async () => {
    const id1 = await importWorkspaces({ a: { p: 'apps/a' }, b: { p: 'apps/b' } }, '2026-01-01T00:00:00.000Z');
    const id2 = await importWorkspaces({ b: { p: 'apps/b', extra: 1 }, c: { p: 'apps/c' } }, '2026-02-01T00:00:00.000Z');

    const result = await compareBackups(m, id1, id2);
    expect(result.removed).toEqual(['a']);
    expect(result.added).toEqual(['c']);
    expect(result.modified).toEqual(['b']);
    expect(result.unchanged).toEqual([]);
  });

  it('marks identical workspaces as unchanged', async () => {
    const id1 = await importWorkspaces({ x: { p: 'apps/x' } }, '2026-01-01T00:00:00.000Z');
    const id2 = await importWorkspaces({ x: { p: 'apps/x' } }, '2026-02-01T00:00:00.000Z');
    const result = await compareBackups(m, id1, id2);
    expect(result.unchanged).toEqual(['x']);
    expect(result.modified).toEqual([]);
  });

  it('throws when either backup is missing', async () => {
    const id1 = await importWorkspaces({});
    await expect(compareBackups(m, id1, 'ghost')).rejects.toThrow(/not found/);
  });
});

describe('factory functions', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-factory-')); });
  afterEach(() => fs.removeSync(root));

  it('createWorkspaceBackupManager returns an initialized manager', async () => {
    const m = await createWorkspaceBackupManager(root);
    expect(m).toBeInstanceOf(WorkspaceBackupManager);
    expect(await fs.pathExists(path.join(root, '.re-shell', 'backups', 'index.json'))).toBe(true);
  });

  it('createQuickBackup produces a named backup with state + templates', async () => {
    const wsFile = await seedWorkspaceFile(root);
    // createQuickBackup uses the default root (cwd); point it at our temp root
    // by constructing the manager ourselves with the same options.
    const m = new WorkspaceBackupManager(root);
    await m.init();
    const id = await m.createBackup(wsFile, {
      name: 'quick-test',
      includeState: true,
      includeTemplates: true,
    });
    const backup = await m.getBackup(id);
    expect(backup!.metadata.name).toBe('quick-test');
    expect(backup!.metadata.includeState).toBe(true);
  });
});
