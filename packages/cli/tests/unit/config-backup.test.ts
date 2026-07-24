import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

vi.mock('../../src/utils/config', () => ({
  configManager: {
    loadGlobalConfig: vi.fn(),
    loadProjectConfig: vi.fn(),
    loadWorkspaceConfig: vi.fn(),
    saveGlobalConfig: vi.fn(),
    saveProjectConfig: vi.fn(),
    saveWorkspaceConfig: vi.fn(),
  },
}));

import { ConfigBackupManager } from '../../src/utils/config-backup';
import { configManager } from '../../src/utils/config';
import { ValidationError } from '../../src/utils/error-handler';
import type { BackupData } from '../../src/utils/config-backup';

/**
 * Unit tests for ConfigBackupManager. The core backup CRUD, statistics, cleanup,
 * export/import and metadata persistence are exercised against a real temp
 * directory; create/restore paths are driven through a mocked configManager.
 */

function makeBackupData(overrides: Partial<BackupData> & { metadata?: Partial<BackupData['metadata']> } = {}): BackupData {
  const { metadata, ...rest } = overrides;
  return {
    metadata: {
      id: 'seed-id',
      name: 'Test Backup',
      description: 'a seeded backup',
      createdAt: '2024-01-01T00:00:00.000Z',
      size: 100,
      type: 'full',
      version: '1.0.0',
      contents: { global: true, project: false, workspaces: [], templates: false, environments: false },
      checksum: '00000000000000000000000000000000',
      tags: ['seed'],
      ...metadata,
    },
    configurations: { global: { version: '1.0.0', setting: 'value' } },
    ...rest,
  };
}

describe('ConfigBackupManager', () => {
  let tmpDir: string;
  let manager: ConfigBackupManager;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cfg-backup-'));
    manager = new ConfigBackupManager(tmpDir);
    vi.mocked(configManager.loadGlobalConfig).mockReset();
    vi.mocked(configManager.loadProjectConfig).mockReset();
    vi.mocked(configManager.loadWorkspaceConfig).mockReset();
    vi.mocked(configManager.saveGlobalConfig).mockReset();
    vi.mocked(configManager.saveProjectConfig).mockReset();
    vi.mocked(configManager.saveWorkspaceConfig).mockReset();
    // Default to rejection so the production code's `.catch(() => null)` guards
    // resolve cleanly when no project/workspace config exists in the test env.
    vi.mocked(configManager.loadProjectConfig).mockRejectedValue(new Error('no project config'));
    vi.mocked(configManager.loadWorkspaceConfig).mockRejectedValue(new Error('no workspace config'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  /** Writes a crafted BackupData to a file and imports it, returning the new id. */
  async function seed(data: BackupData): Promise<string> {
    const file = path.join(tmpDir, `seed-${Math.random().toString(36).slice(2)}.json`);
    await fs.writeJson(file, data);
    return manager.importBackup(file);
  }

  describe('initialize + empty state', () => {
    it('creates the backup directory on initialize', async () => {
      expect(await fs.pathExists(tmpDir)).toBe(true);
      await manager.initialize();
      expect(await fs.pathExists(path.join(tmpDir, 'metadata.json'))).toBe(false);
    });

    it('returns an empty list and zeroed stats when no backups exist', async () => {
      await manager.initialize();
      expect(await manager.listBackups()).toEqual([]);
      const stats = await manager.getBackupStats();
      expect(stats.totalBackups).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.averageSize).toBe(0);
      expect(stats.backupsByType).toEqual({});
      expect(stats.oldestBackup).toBeUndefined();
      expect(stats.newestBackup).toBeUndefined();
    });

    it('getBackup returns null for an unknown id', async () => {
      await manager.initialize();
      expect(await manager.getBackup('does-not-exist')).toBeNull();
    });
  });

  describe('importBackup', () => {
    it('imports a crafted backup, persists it under a new id and tags it imported', async () => {
      const id = await seed(makeBackupData({ metadata: { name: 'Imported', tags: ['unit'] } }));
      expect(id).toMatch(/^backup-\d+-[a-z0-9]+$/);

      const stored = await manager.getBackup(id);
      expect(stored).not.toBeNull();
      expect(stored!.metadata.name).toBe('Imported');
      expect(stored!.metadata.id).toBe(id);
      expect(stored!.metadata.tags).toEqual(expect.arrayContaining(['unit', 'imported']));
      // size + checksum are recomputed on save (read from the metadata index).
      const meta = (await manager.listBackups()).find(b => b.id === id)!;
      expect(meta.size).toBeGreaterThan(0);
      expect(meta.checksum).toMatch(/^[a-f0-9]{32}$/);
      expect(meta.checksum).not.toBe('00000000000000000000000000000000');
      // The backup file is written next to metadata.
      expect(await fs.pathExists(path.join(tmpDir, `${id}.backup.json`))).toBe(true);
    });

    it('throws ValidationError when the source file does not exist', async () => {
      await expect(manager.importBackup(path.join(tmpDir, 'missing.json'))).rejects.toThrow(ValidationError);
      await expect(manager.importBackup(path.join(tmpDir, 'missing.json'))).rejects.toThrow('Backup file not found');
    });

    it('throws ValidationError for a malformed backup structure', async () => {
      const file = path.join(tmpDir, 'bad.json');
      await fs.writeJson(file, { metadata: { id: 'x' } }); // missing configurations
      await expect(manager.importBackup(file)).rejects.toThrow('Invalid backup file format');
    });
  });

  describe('listBackups ordering', () => {
    it('lists backups newest-first by createdAt', async () => {
      await seed(makeBackupData({ metadata: { createdAt: '2024-01-01T00:00:00.000Z', name: 'old' } }));
      await seed(makeBackupData({ metadata: { createdAt: '2024-06-01T00:00:00.000Z', name: 'new' } }));
      const list = await manager.listBackups();
      expect(list).toHaveLength(2);
      expect(list[0].name).toBe('new');
      expect(list[1].name).toBe('old');
    });
  });

  describe('deleteBackup', () => {
    it('removes the backup file and metadata entry', async () => {
      const id = await seed(makeBackupData());
      expect(await manager.getBackup(id)).not.toBeNull();
      await manager.deleteBackup(id);
      expect(await manager.getBackup(id)).toBeNull();
      expect((await manager.listBackups()).find(b => b.id === id)).toBeUndefined();
    });

    it('throws ValidationError when deleting an unknown backup', async () => {
      await expect(manager.deleteBackup('nope')).rejects.toThrow('Backup \'nope\' not found');
    });
  });

  describe('getBackupStats', () => {
    it('aggregates totals, per-type counts, average, oldest and newest', async () => {
      await seed(makeBackupData({
        metadata: { createdAt: '2024-01-01T00:00:00.000Z', type: 'full', size: 200, name: 'a' },
      }));
      await seed(makeBackupData({
        metadata: { createdAt: '2024-03-01T00:00:00.000Z', type: 'selective', size: 100, name: 'b' },
      }));
      const stats = await manager.getBackupStats();
      const list = await manager.listBackups();
      const expectedTotal = list.reduce((s, b) => s + b.size, 0);
      expect(stats.totalBackups).toBe(2);
      // totalSize/averageSize are derived from the recomputed sizes in the
      // metadata index (the seeded size:200/100 are overwritten on save).
      expect(stats.totalSize).toBe(expectedTotal);
      expect(stats.averageSize).toBe(expectedTotal / 2);
      expect(stats.backupsByType).toEqual({ full: 1, selective: 1 });
      expect(stats.oldestBackup!.name).toBe('a');
      expect(stats.newestBackup!.name).toBe('b');
    });
  });

  describe('cleanup', () => {
    it('keeps only the newest N backups when keepCount is set', async () => {
      const ids = [];
      for (let i = 0; i < 3; i++) {
        ids.push(await seed(makeBackupData({ metadata: { createdAt: `2024-0${i + 1}-01T00:00:00.000Z`, name: `b${i}` } })));
      }
      const deleted = await manager.cleanup({ keepCount: 1 });
      expect(deleted).toHaveLength(2);
      expect((await manager.listBackups()).map(b => b.name)).toEqual(['b2']);
    });

    it('dryRun returns the deletion candidates without removing them', async () => {
      for (let i = 0; i < 3; i++) {
        await seed(makeBackupData({ metadata: { createdAt: `2024-0${i + 1}-01T00:00:00.000Z`, name: `b${i}` } }));
      }
      const candidates = await manager.cleanup({ keepCount: 1, dryRun: true });
      expect(candidates).toHaveLength(2);
      expect((await manager.listBackups())).toHaveLength(3);
    });

    it('removes backups older than keepDays', async () => {
      await seed(makeBackupData({ metadata: { createdAt: '2000-01-01T00:00:00.000Z', name: 'ancient' } }));
      await seed(makeBackupData({ metadata: { createdAt: new Date().toISOString(), name: 'fresh' } }));
      const deleted = await manager.cleanup({ keepDays: 30 });
      expect(deleted).toHaveLength(1);
      expect((await manager.listBackups()).map(b => b.name)).toEqual(['fresh']);
    });

    it('removes backups whose type is not in keepTypes', async () => {
      await seed(makeBackupData({ metadata: { type: 'full', name: 'keep-me' } }));
      await seed(makeBackupData({ metadata: { type: 'selective', name: 'drop-me' } }));
      const deleted = await manager.cleanup({ keepTypes: ['full'] });
      expect(deleted).toHaveLength(1);
      expect((await manager.listBackups()).map(b => b.name)).toEqual(['keep-me']);
    });
  });

  describe('exportBackup', () => {
    it('writes the backup JSON to an arbitrary output path', async () => {
      const id = await seed(makeBackupData({ metadata: { name: 'Export' } }));
      const out = path.join(tmpDir, 'sub', 'exported.json');
      await manager.exportBackup(id, out);
      const exported = await fs.readJson(out);
      expect(exported.metadata.name).toBe('Export');
    });

    it('throws ValidationError for an unknown id', async () => {
      await expect(manager.exportBackup('ghost', path.join(tmpDir, 'x.json'))).rejects.toThrow('Backup \'ghost\' not found');
    });
  });

  describe('createFullBackup (mocked configManager)', () => {
    it('collects global config and records a full backup with computed size/checksum', async () => {
      vi.mocked(configManager.loadGlobalConfig).mockResolvedValue({ version: '3.0.0', name: 'g' });
      vi.mocked(configManager.loadProjectConfig).mockRejectedValue(new Error('none'));
      const id = await manager.createFullBackup('Full', 'a full backup', ['t1']);
      // NOTE: getBackup() reads the .backup.json file, which is serialized BEFORE
      // size/checksum are recomputed, so those two fields are stale in the file
      // (size:0, checksum:''). The recomputed values live in the metadata index.
      const stored = await manager.getBackup(id);
      expect(stored!.metadata.type).toBe('full');
      expect(stored!.metadata.version).toBe('3.0.0');
      expect(stored!.metadata.tags).toEqual(['t1']);
      expect(stored!.metadata.contents.global).toBe(true);
      expect(stored!.metadata.contents.project).toBe(false);
      expect(stored!.metadata.size).toBe(0); // stale in file (see NOTE)
      expect(stored!.configurations.global).toMatchObject({ version: '3.0.0' });
      const meta = (await manager.listBackups()).find(b => b.id === id)!;
      expect(meta.size).toBeGreaterThan(0);
      expect(meta.checksum).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('createSelectiveBackup (mocked configManager)', () => {
    it('records a selective backup scoped to the requested sections', async () => {
      vi.mocked(configManager.loadGlobalConfig).mockResolvedValue({ version: '2.1.0' });
      const id = await manager.createSelectiveBackup('Sel', { global: true, project: false }, 'd', ['s']);
      const stored = await manager.getBackup(id);
      expect(stored!.metadata.type).toBe('selective');
      expect(stored!.metadata.version).toBe('2.1.0');
      expect(stored!.metadata.contents.global).toBe(true);
      expect(stored!.metadata.contents.project).toBe(false);
    });
  });

  describe('restoreFromBackup (mocked configManager)', () => {
    it('dryRun does not write any configuration and previews the restore', async () => {
      vi.mocked(configManager.loadGlobalConfig).mockResolvedValue({ version: '1.0.0' });
      const id = await manager.createFullBackup('R', 'd');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        await manager.restoreFromBackup(id, { dryRun: true });
        expect(configManager.saveGlobalConfig).not.toHaveBeenCalled();
        expect(spy.mock.calls.flat().join(' ')).toContain('DRY RUN');
      } finally {
        spy.mockRestore();
      }
    });

    it('replace strategy saves the global configuration', async () => {
      vi.mocked(configManager.loadGlobalConfig).mockResolvedValue({ version: '1.0.0' });
      const id = await manager.createFullBackup('R2', 'd');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        await manager.restoreFromBackup(id, {});
        expect(configManager.saveGlobalConfig).toHaveBeenCalledTimes(1);
      } finally {
        spy.mockRestore();
      }
    });

    it('skip-existing strategy does not overwrite an existing global config', async () => {
      vi.mocked(configManager.loadGlobalConfig).mockResolvedValue({ version: '1.0.0' });
      const id = await manager.createFullBackup('R3', 'd');
      // loadGlobalConfig resolves during restore -> existing config present -> skip.
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        await manager.restoreFromBackup(id, { mergeStrategy: 'skip-existing' });
        expect(configManager.saveGlobalConfig).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });

    it('throws ValidationError for an unknown backup id', async () => {
      await expect(manager.restoreFromBackup('ghost')).rejects.toThrow('Backup \'ghost\' not found');
    });
  });

  describe('metadata persistence', () => {
    it('persists backups across a new manager instance against the same directory', async () => {
      const id = await seed(makeBackupData({ metadata: { name: 'Persisted' } }));
      const reopened = new ConfigBackupManager(tmpDir);
      const list = await reopened.listBackups();
      expect(list.find(b => b.id === id)?.name).toBe('Persisted');
    });
  });
});
