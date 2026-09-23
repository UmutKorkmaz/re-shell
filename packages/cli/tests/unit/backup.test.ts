import { describe, it, expect, beforeEach, vi } from 'vitest';
import { manageBackups } from '../../src/commands/backup';
import { ValidationError } from '../../src/utils/error-handler';
import type { BackupData, BackupMetadata, BackupStats } from '../../src/utils/config-backup';

// Covers src/commands/backup.ts — the `backup` command group (753 lines):
// create (full/selective/interactive), restore, list, delete, export,
// import, cleanup, stats, interactive, default status. The
// configBackupManager singleton is mocked; prompts are mocked for all
// confirmation/interactive flows.

const mocks = vi.hoisted(() => ({
  prompts: vi.fn(),
  manager: {
    createFullBackup: vi.fn(),
    createSelectiveBackup: vi.fn(),
    listBackups: vi.fn(),
    getBackup: vi.fn(),
    deleteBackup: vi.fn(),
    restoreFromBackup: vi.fn(),
    getBackupStats: vi.fn(),
    cleanup: vi.fn(),
    exportBackup: vi.fn(),
    importBackup: vi.fn(),
  },
}));

vi.mock('prompts', () => ({ default: mocks.prompts }));
vi.mock('../../src/utils/config-backup', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/utils/config-backup')>();
  return { ...original, configBackupManager: mocks.manager };
});

const M = mocks.manager;

function meta(overrides: Partial<BackupMetadata> = {}): BackupMetadata {
  return {
    id: 'bak-1',
    name: 'Nightly backup',
    type: 'full',
    createdAt: new Date('2026-01-15T10:00:00Z').toISOString(),
    size: 2048,
    description: undefined,
    tags: ['nightly'],
    checksum: 'abc123',
    version: '1.0.0',
    contents: {
      global: true,
      project: true,
      workspaces: ['web'],
      templates: true,
      environments: false,
    },
    ...overrides,
  } as BackupMetadata;
}

function stats(overrides: Partial<BackupStats> = {}): BackupStats {
  return {
    totalBackups: 2,
    totalSize: 4096,
    averageSize: 2048,
    backupsByType: { full: 1, selective: 1 },
    oldestBackup: meta({ id: 'bak-old', name: 'Oldest' }),
    newestBackup: meta({ id: 'bak-new', name: 'Newest' }),
    ...overrides,
  } as BackupStats;
}

/** Full spinner stub — handlers call setText/stop/succeed/fail. */
function stubSpinner() {
  return {
    setText: vi.fn(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  };
}

let logSpy: ReturnType<typeof vi.spyOn>;

function output(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

describe('backup — command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    M.createFullBackup.mockResolvedValue('full-bak-id');
    M.createSelectiveBackup.mockResolvedValue('sel-bak-id');
    M.listBackups.mockResolvedValue([meta()]);
    M.getBackup.mockResolvedValue({
      metadata: meta(),
      data: {},
    } as unknown as BackupData);
    M.getBackupStats.mockResolvedValue(stats());
    M.cleanup.mockResolvedValue([]);
    M.deleteBackup.mockResolvedValue(undefined);
    M.restoreFromBackup.mockResolvedValue(undefined);
    M.exportBackup.mockResolvedValue(undefined);
    M.importBackup.mockResolvedValue('imported-id');
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  describe('create', () => {
    it('creates a full backup by default with a date-based name', async () => {
      await manageBackups({ create: true, name: 'my-backup' });
      expect(M.createFullBackup).toHaveBeenCalledWith(
        'my-backup',
        undefined,
        []
      );
      expect(output()).toContain('Backup Created');
      expect(output()).toContain('ID: full-bak-id');
      expect(output()).toContain('Name: my-backup');
    });

    it('passes description and comma-separated tags', async () => {
      await manageBackups({
        create: true,
        description: 'before migration',
        tags: 'a, b ,c',
      });
      expect(M.createFullBackup).toHaveBeenCalledWith(
        expect.stringContaining('full-backup-'),
        'before migration',
        ['a', 'b', 'c']
      );
      expect(output()).toContain('Description: before migration');
      expect(output()).toContain('Tags: a, b, c');
    });

    it('creates a selective backup with default contents', async () => {
      await manageBackups({ create: true, selective: true });
      expect(M.createSelectiveBackup).toHaveBeenCalledWith(
        expect.stringContaining('selective-backup-'),
        expect.objectContaining({
          global: true,
          project: true,
          templates: true,
          environments: false,
        }),
        undefined,
        ['selective']
      );
      expect(output()).toContain('Selective Backup Created');
      expect(output()).toContain('global, project, templates');
    });

    it('interactive create builds a full backup from prompt answers', async () => {
      mocks.prompts.mockResolvedValueOnce({
        type: 'full',
        name: 'prompted',
        description: 'desc',
        tags: ['x'],
      });
      await manageBackups({ create: true, interactive: true });
      expect(M.createFullBackup).toHaveBeenCalledWith('prompted', 'desc', ['x']);
      expect(output()).toContain('Full backup created: full-bak-id');
    });

    it('interactive create builds a selective backup from multiselect', async () => {
      mocks.prompts
        .mockResolvedValueOnce({
          type: 'selective',
          name: 'sel-prompted',
          description: undefined,
          tags: [],
        })
        .mockResolvedValueOnce({ contents: ['global', 'environments'] });
      await manageBackups({ create: true, interactive: true });
      expect(M.createSelectiveBackup).toHaveBeenCalledWith(
        'sel-prompted',
        expect.objectContaining({
          global: true,
          project: false,
          environments: true,
        }),
        undefined,
        []
      );
    });

    it('interactive create aborts when the name prompt is cancelled', async () => {
      mocks.prompts.mockResolvedValueOnce({ type: 'full' });
      await manageBackups({ create: true, interactive: true });
      expect(M.createFullBackup).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('fails with a notice for an unknown backup id', async () => {
      M.getBackup.mockResolvedValueOnce(null);
      const spinner = stubSpinner();
      await manageBackups({ restore: 'ghost', spinner });
      expect(spinner.fail).toHaveBeenCalledWith(
        expect.stringContaining("'ghost' not found")
      );
      expect(M.restoreFromBackup).not.toHaveBeenCalled();
    });

    it('asks for confirmation and restores with default options', async () => {
      mocks.prompts.mockResolvedValueOnce({ confirmed: true });
      await manageBackups({ restore: 'bak-1' });
      expect(M.restoreFromBackup).toHaveBeenCalledWith('bak-1', {
        force: undefined,
        createBackupBeforeRestore: true,
        dryRun: undefined,
        mergeStrategy: 'replace',
      });
      expect(output()).toContain('Configuration restored successfully!');
      expect(output()).toContain('Nightly backup');
    });

    it('cancels when the confirmation is declined', async () => {
      mocks.prompts.mockResolvedValueOnce({ confirmed: false });
      await manageBackups({ restore: 'bak-1' });
      expect(output()).toContain('Restoration cancelled.');
      expect(M.restoreFromBackup).not.toHaveBeenCalled();
    });

    it('skips confirmation with --force and forwards the merge strategy', async () => {
      await manageBackups({
        restore: 'bak-1',
        force: true,
        mergeStrategy: 'merge',
        preBackup: false,
      });
      expect(mocks.prompts).not.toHaveBeenCalled();
      expect(M.restoreFromBackup).toHaveBeenCalledWith('bak-1', {
        force: true,
        createBackupBeforeRestore: false,
        dryRun: undefined,
        mergeStrategy: 'merge',
      });
    });

    it('does not print the success banner in dry-run mode', async () => {
      await manageBackups({ restore: 'bak-1', force: true, dryRun: true });
      expect(M.restoreFromBackup).toHaveBeenCalledWith(
        'bak-1',
        expect.objectContaining({ dryRun: true })
      );
      expect(output()).not.toContain('restored successfully');
    });
  });

  describe('list', () => {
    it('suggests creating the first backup when none exist', async () => {
      M.listBackups.mockResolvedValueOnce([]);
      await manageBackups({ list: true });
      expect(output()).toContain('No backups found.');
      expect(output()).toContain('re-shell backup create');
    });

    it('renders name, type, contents, tags and age', async () => {
      await manageBackups({ list: true });
      const out = output();
      expect(out).toContain('Configuration Backups (1)');
      expect(out).toContain('Nightly backup');
      expect(out).toContain('ID: bak-1');
      expect(out).toContain('full');
      expect(out).toContain('Contents: global, project, workspaces(1), templates');
      expect(out).toContain('Tags: nightly');
    });

    it('emits the raw metadata array in JSON mode', async () => {
      await manageBackups({ list: true, json: true });
      const payload = JSON.parse(
        logSpy.mock.calls[logSpy.mock.calls.length - 1][0]
      );
      expect(payload).toEqual([expect.objectContaining({ id: 'bak-1' })]);
    });

    it('includes checksum and version in verbose mode', async () => {
      await manageBackups({ list: true, verbose: true });
      expect(output()).toContain('Checksum: abc123');
      expect(output()).toContain('Version: 1.0.0');
    });
  });

  describe('delete', () => {
    it('fails with a notice for an unknown backup id', async () => {
      M.getBackup.mockResolvedValueOnce(null);
      const spinner = stubSpinner();
      await manageBackups({ delete: 'ghost', spinner });
      expect(spinner.fail).toHaveBeenCalled();
      expect(M.deleteBackup).not.toHaveBeenCalled();
    });

    it('asks for confirmation before deleting', async () => {
      mocks.prompts.mockResolvedValueOnce({ confirmed: true });
      await manageBackups({ delete: 'bak-1' });
      expect(M.deleteBackup).toHaveBeenCalledWith('bak-1');
      expect(output()).toContain("'Nightly backup' deleted successfully!");
    });

    it('cancels when deletion is declined', async () => {
      mocks.prompts.mockResolvedValueOnce({ confirmed: false });
      await manageBackups({ delete: 'bak-1' });
      expect(output()).toContain('Deletion cancelled.');
      expect(M.deleteBackup).not.toHaveBeenCalled();
    });

    it('deletes without prompting with --force', async () => {
      await manageBackups({ delete: 'bak-1', force: true });
      expect(mocks.prompts).not.toHaveBeenCalled();
      expect(M.deleteBackup).toHaveBeenCalledWith('bak-1');
    });
  });

  describe('export / import', () => {
    it('requires --output for export', async () => {
      await expect(manageBackups({ export: 'bak-1' })).rejects.toThrow(
        ValidationError
      );
      await expect(manageBackups({ export: 'bak-1' })).rejects.toThrow(
        'Output file path is required'
      );
    });

    it('exports to the requested path', async () => {
      await manageBackups({ export: 'bak-1', output: '/tmp/bak.json' });
      expect(M.exportBackup).toHaveBeenCalledWith('bak-1', '/tmp/bak.json');
      expect(output()).toContain('Backup Exported');
      expect(output()).toContain('/tmp/bak.json');
    });

    it('imports from a file and reports the new id', async () => {
      await manageBackups({ import: '/tmp/bak.json' });
      expect(M.importBackup).toHaveBeenCalledWith('/tmp/bak.json');
      expect(output()).toContain('Backup Imported');
      expect(output()).toContain('ID: imported-id');
    });
  });

  describe('cleanup', () => {
    it('reports when nothing needs cleanup', async () => {
      M.cleanup.mockResolvedValueOnce([]);
      await manageBackups({ cleanup: true });
      expect(output()).toContain('No backups need cleanup');
    });

    it('previews deletions in dry-run mode', async () => {
      M.cleanup.mockResolvedValueOnce(['bak-1', 'bak-2']);
      await manageBackups({ cleanup: true, dryRun: true, keepCount: 5, keepDays: 30 });
      expect(M.cleanup).toHaveBeenCalledWith({
        keepCount: 5,
        keepDays: 30,
        dryRun: true,
      });
      const out = output();
      expect(out).toContain('Cleanup Preview (2 backups would be deleted)');
      expect(out).toContain('bak-1');
    });

    it('reports completed deletions when applied', async () => {
      M.cleanup.mockResolvedValueOnce(['bak-1']);
      await manageBackups({ cleanup: true });
      expect(output()).toContain('Cleanup Complete (1 backups deleted)');
    });
  });

  describe('stats', () => {
    it('renders totals, size and per-type breakdown', async () => {
      await manageBackups({ stats: true });
      const out = output();
      expect(out).toContain('Backup Statistics');
      expect(out).toContain('Total backups: 2');
      expect(out).toContain('Total size: 4 KB');
      expect(out).toContain('Average size: 2 KB');
      expect(out).toContain('Oldest: Oldest');
      expect(out).toContain('Newest: Newest');
      expect(out).toContain('full: 1');
      expect(out).toContain('selective: 1');
    });

    it('emits raw stats in JSON mode', async () => {
      await manageBackups({ stats: true, json: true });
      const payload = JSON.parse(
        logSpy.mock.calls[logSpy.mock.calls.length - 1][0]
      );
      expect(payload.totalBackups).toBe(2);
    });
  });

  describe('default status', () => {
    it('warns when there are no backups', async () => {
      M.getBackupStats.mockResolvedValueOnce(stats({ totalBackups: 0 }));
      await manageBackups({});
      expect(output()).toContain('No backups found');
      expect(output()).toContain('backup create --full');
    });

    it('reports backup count, size and latest age', async () => {
      await manageBackups({});
      const out = output();
      expect(out).toContain('Backup System Status');
      expect(out).toContain('2 backup(s) available');
      expect(out).toContain('Total size: 4 KB');
      expect(out).toContain('Latest backup:');
    });
  });

  describe('interactive', () => {
    it('does nothing when the action prompt is cancelled', async () => {
      mocks.prompts.mockResolvedValueOnce({});
      await manageBackups({ interactive: true });
      expect(M.listBackups).not.toHaveBeenCalled();
    });

    it('dispatches list through the interactive menu', async () => {
      mocks.prompts.mockResolvedValueOnce({ action: 'list' });
      await manageBackups({ interactive: true });
      expect(M.listBackups).toHaveBeenCalled();
      expect(output()).toContain('Configuration Backups (1)');
    });

    it('dispatches stats through the interactive menu', async () => {
      mocks.prompts.mockResolvedValueOnce({ action: 'stats' });
      await manageBackups({ interactive: true });
      expect(output()).toContain('Backup Statistics');
    });

    it('restore declines gracefully when no backups exist', async () => {
      mocks.prompts
        .mockResolvedValueOnce({ action: 'restore' })
        .mockResolvedValueOnce({});
      M.listBackups.mockResolvedValueOnce([]);
      await manageBackups({ interactive: true });
      expect(output()).toContain('No backups available for restoration');
    });
  });

  describe('error handling', () => {
    it('fails the spinner and rethrows on manager errors', async () => {
      M.createFullBackup.mockRejectedValueOnce(new Error('disk full'));
      const spinner = stubSpinner();
      M.createFullBackup.mockRejectedValueOnce(new Error('disk full'));
      await expect(manageBackups({ create: true, spinner })).rejects.toThrow(
        'disk full'
      );
      expect(spinner.fail).toHaveBeenCalledWith(
        expect.stringContaining('Backup operation failed')
      );
    });
  });
});
