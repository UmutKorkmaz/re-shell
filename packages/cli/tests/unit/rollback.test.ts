import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  createSnapshot,
  trackFileCreation,
  trackFileModification,
  rollbackOperation,
  cleanupSnapshots,
  executeWithRollback,
  listSnapshots,
  recoverFromSnapshot,
  RollbackSnapshot,
} from '../../src/utils/rollback';

/**
 * Every rollback helper resolves paths against `process.cwd()`, so each test
 * stubs process.cwd() to a fresh temp dir. vitest workers forbid process.chdir(),
 * so we monkey-patch process.cwd() directly and restore it in finally.
 */
function withCwd<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.cwd;
  const restore = () => {
    Object.defineProperty(process, 'cwd', { value: prev, configurable: true });
  };
  Object.defineProperty(process, 'cwd', { value: () => dir, configurable: true });
  return fn().finally(restore);
}

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rs-rb-${Date.now()}-`));
}

function readSnapshot(dir: string, id: string): RollbackSnapshot {
  return fs.readJsonSync(
    path.join(dir, '.re-shell', 'rollback-snapshots', id, 'snapshot.json'),
  );
}

describe('createSnapshot', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpRoot();
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('writes snapshot.json under .re-shell/rollback-snapshots/<id>', async () => {
    const id = await withCwd(dir, () => createSnapshot('test-op'));
    const snapshot = readSnapshot(dir, id);
    expect(snapshot.operation).toBe('test-op');
    expect(snapshot.id).toBe(id);
    expect(snapshot.id.startsWith('test-op-')).toBe(true);
  });

  it('records an ISO-8601 timestamp', async () => {
    const id = await withCwd(dir, () => createSnapshot('iso-op'));
    const snapshot = readSnapshot(dir, id);
    expect(snapshot.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it('initializes empty filesCreated and filesModified arrays', async () => {
    const id = await withCwd(dir, () => createSnapshot('empty'));
    const snapshot = readSnapshot(dir, id);
    expect(snapshot.filesCreated).toEqual([]);
    expect(snapshot.filesModified).toEqual([]);
  });

  it('statePath equals process.cwd()', async () => {
    const id = await withCwd(dir, () => createSnapshot('cwd'));
    const snapshot = readSnapshot(dir, id);
    expect(snapshot.statePath).toBe(dir);
  });

  it('persists metadata from options', async () => {
    const id = await withCwd(dir, () =>
      createSnapshot('meta', {
        projectName: 'demo',
        framework: 'react',
        template: 'spa',
      }),
    );
    const snapshot = readSnapshot(dir, id);
    expect(snapshot.metadata.projectName).toBe('demo');
    expect(snapshot.metadata.framework).toBe('react');
    expect(snapshot.metadata.template).toBe('spa');
  });

  it('creates a backup directory when createBackup option is true', async () => {
    const id = await withCwd(dir, () =>
      createSnapshot('bk', { createBackup: true }),
    );
    const snapshot = readSnapshot(dir, id);
    expect(fs.existsSync(snapshot.backupPath)).toBe(true);
  });

  it('backs up existing package.json when createBackup is true', async () => {
    await fs.writeJson(path.join(dir, 'package.json'), { name: 'demo' });
    const id = await withCwd(dir, () =>
      createSnapshot('bk-pkg', { createBackup: true }),
    );
    const snapshot = readSnapshot(dir, id);
    const backed = path.join(snapshot.backupPath, 'package.json');
    expect(fs.existsSync(backed)).toBe(true);
    expect(fs.readJsonSync(backed).name).toBe('demo');
  });

  it('does NOT create a backup directory when createBackup is false', async () => {
    const id = await withCwd(dir, () => createSnapshot('no-bk'));
    const snapshot = readSnapshot(dir, id);
    expect(fs.existsSync(snapshot.backupPath)).toBe(false);
  });

  it('prints verbose progress when verbose option is true', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await withCwd(dir, () =>
        createSnapshot('verbose-op', { verbose: true }),
      );
      const text = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(text).toContain('Created rollback snapshot');
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('trackFileCreation', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpRoot();
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('appends a path to filesCreated', async () => {
    const id = await withCwd(dir, () => createSnapshot('op'));
    await withCwd(dir, () => trackFileCreation(id, '/tmp/foo.txt'));
    expect(readSnapshot(dir, id).filesCreated).toEqual(['/tmp/foo.txt']);
  });

  it('preserves previous entries when called twice', async () => {
    const id = await withCwd(dir, () => createSnapshot('op'));
    await withCwd(dir, () => trackFileCreation(id, '/a'));
    await withCwd(dir, () => trackFileCreation(id, '/b'));
    expect(readSnapshot(dir, id).filesCreated).toEqual(['/a', '/b']);
  });

  it('no-ops silently when the snapshot is missing', async () => {
    await expect(
      withCwd(dir, () => trackFileCreation('nonexistent', '/x')),
    ).resolves.toBeUndefined();
  });
});

describe('trackFileModification', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpRoot();
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('appends a path to filesModified', async () => {
    const id = await withCwd(dir, () => createSnapshot('op'));
    await withCwd(dir, () => trackFileModification(id, '/tmp/bar.txt'));
    expect(readSnapshot(dir, id).filesModified).toEqual(['/tmp/bar.txt']);
  });

  it('no-ops silently when the snapshot is missing', async () => {
    await expect(
      withCwd(dir, () => trackFileModification('nonexistent', '/x')),
    ).resolves.toBeUndefined();
  });
});

describe('rollbackOperation', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpRoot();
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('returns false when the snapshot does not exist', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const result = await withCwd(dir, () => rollbackOperation('nope'));
      expect(result).toBe(false);
      expect(
        logSpy.mock.calls.map((c) => c.join(' ')).join('\n'),
      ).toContain('Snapshot not found');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('removes tracked created files', async () => {
    const created = path.join(dir, 'new.txt');
    await fs.writeFile(created, 'content');
    const id = await withCwd(dir, () => createSnapshot('rm'));
    await withCwd(dir, () => trackFileCreation(id, created));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const ok = await withCwd(dir, () => rollbackOperation(id));
      expect(ok).toBe(true);
      expect(fs.existsSync(created)).toBe(false);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('counts but does not fail when the created file is already gone', async () => {
    const missing = path.join(dir, 'ghost.txt');
    const id = await withCwd(dir, () => createSnapshot('ghost'));
    await withCwd(dir, () => trackFileCreation(id, missing));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const ok = await withCwd(dir, () => rollbackOperation(id));
      expect(ok).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('restores modified files from the backup directory', async () => {
    // Seed an original file that the snapshot will back up.
    await fs.writeJson(path.join(dir, 'package.json'), { version: 'old' });

    const id = await withCwd(dir, () =>
      createSnapshot('restore', { createBackup: true }),
    );

    // Simulate a modification that the operator makes after snapshot.
    await fs.writeJson(path.join(dir, 'package.json'), { version: 'new' });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const ok = await withCwd(dir, () =>
        rollbackOperation(id, { keepBackup: true }),
      );
      expect(ok).toBe(true);
      expect(fs.readJsonSync(path.join(dir, 'package.json')).version).toBe(
        'old',
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it('removes the snapshot directory when keepBackup is false (default)', async () => {
    const id = await withCwd(dir, () => createSnapshot('cleanup'));
    const snapshotDir = path.join(dir, '.re-shell', 'rollback-snapshots', id);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await withCwd(dir, () => rollbackOperation(id));
      expect(fs.existsSync(snapshotDir)).toBe(false);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('keeps the snapshot directory when keepBackup is true', async () => {
    const id = await withCwd(dir, () => createSnapshot('keep'));
    const snapshotDir = path.join(dir, '.re-shell', 'rollback-snapshots', id);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await withCwd(dir, () => rollbackOperation(id, { keepBackup: true }));
      expect(fs.existsSync(snapshotDir)).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('cleanupSnapshots', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpRoot();
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('no-ops when no snapshots directory exists', async () => {
    await expect(withCwd(dir, () => cleanupSnapshots(5))).resolves.toBeUndefined();
    expect(fs.existsSync(path.join(dir, '.re-shell', 'rollback-snapshots'))).toBe(
      false,
    );
  });

  it('keeps the most recent N snapshots', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      // Vary mtime by writing snapshots sequentially with small delays.
      const id = await withCwd(dir, () => createSnapshot(`op${i}`));
      ids.push(id);
      // Bump the snapshot directory's mtime so sorting is stable.
      const snapshotDir = path.join(
        dir,
        '.re-shell',
        'rollback-snapshots',
        id,
      );
      const future = Date.now() / 1000 + i * 10;
      await fs.utimes(snapshotDir, future, future);
    }

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await withCwd(dir, () => cleanupSnapshots(2));
    } finally {
      logSpy.mockRestore();
    }

    const remaining = await fs.readdir(
      path.join(dir, '.re-shell', 'rollback-snapshots'),
    );
    expect(remaining.length).toBe(2);
  });

  it('keeps all when fewer than keepCount exist', async () => {
    for (let i = 0; i < 3; i++) {
      await withCwd(dir, () => createSnapshot(`op${i}`));
    }
    await withCwd(dir, () => cleanupSnapshots(5));
    const remaining = await fs.readdir(
      path.join(dir, '.re-shell', 'rollback-snapshots'),
    );
    expect(remaining.length).toBe(3);
  });
});

describe('executeWithRollback', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpRoot();
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('returns the resolved value and cleans up the snapshot on success', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const result = await withCwd(dir, () =>
        executeWithRollback('happy', async () => 'ok'),
      );
      expect(result).toBe('ok');
      // No snapshot directory should remain after success.
      const remaining = await fs.readdir(
        path.join(dir, '.re-shell', 'rollback-snapshots'),
      );
      expect(remaining.length).toBe(0);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('rolls back and re-throws when fn rejects', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await expect(
        withCwd(dir, () =>
          executeWithRollback('sad', async () => {
            throw new Error('boom');
          }),
        ),
      ).rejects.toThrow('boom');
      // Snapshot should be cleaned up by rollback (keepBackup defaults to false).
      const remaining = await fs.readdir(
        path.join(dir, '.re-shell', 'rollback-snapshots'),
      );
      expect(remaining.length).toBe(0);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('keeps the snapshot when keepBackup is true on failure', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await expect(
        withCwd(dir, () =>
          executeWithRollback(
            'kept',
            async () => {
              throw new Error('fail');
            },
            { keepBackup: true },
          ),
        ),
      ).rejects.toThrow('fail');
      const remaining = await fs.readdir(
        path.join(dir, '.re-shell', 'rollback-snapshots'),
      );
      expect(remaining.length).toBe(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('passes the snapshot ID to fn so it can track files', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      let receivedId = '';
      await withCwd(dir, () =>
        executeWithRollback('tracked', async (id) => {
          receivedId = id;
          await trackFileCreation(id, '/tmp/something');
        }),
      );
      expect(receivedId).toBeTruthy();
      expect(receivedId.startsWith('tracked-')).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('listSnapshots', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpRoot();
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('prints "No rollback snapshots found" when the directory is absent', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await withCwd(dir, () => listSnapshots());
      const text = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(text).toContain('No rollback snapshots found');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('lists each snapshot with id/operation/counts', async () => {
    await withCwd(dir, () => createSnapshot('alpha'));
    await withCwd(dir, () => createSnapshot('beta'));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await withCwd(dir, () => listSnapshots());
      const text = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(text).toContain('Available Rollback Snapshots');
      expect(text).toContain('Operation: alpha');
      expect(text).toContain('Operation: beta');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('includes project name when snapshot metadata has one', async () => {
    await withCwd(dir, () =>
      createSnapshot('with-proj', { projectName: 'demo-app' }),
    );
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await withCwd(dir, () => listSnapshots());
      const text = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(text).toContain('Project: demo-app');
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('recoverFromSnapshot', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpRoot();
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('returns false when the snapshot does not exist', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const result = await withCwd(dir, () => recoverFromSnapshot('missing'));
      expect(result).toBe(false);
      const text = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(text).toContain('Snapshot not found');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('returns false when the user declines the prompts confirmation', async () => {
    const id = await withCwd(dir, () => createSnapshot('decline'));

    // Mock the dynamic prompts import to return confirmed=false.
    vi.doMock('prompts', () => ({
      default: () => Promise.resolve({ value: false }),
    }));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const result = await withCwd(dir, () => recoverFromSnapshot(id));
      expect(result).toBe(false);
      const text = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(text).toContain('Recovery cancelled');
    } finally {
      logSpy.mockRestore();
      vi.doUnmock('prompts');
    }
  });

  it('performs rollback when the user confirms', async () => {
    const id = await withCwd(dir, () => createSnapshot('confirm'));

    vi.doMock('prompts', () => ({
      default: () => Promise.resolve({ value: true }),
    }));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const result = await withCwd(dir, () => recoverFromSnapshot(id));
      expect(result).toBe(true);
    } finally {
      logSpy.mockRestore();
      vi.doUnmock('prompts');
    }
  });
});
