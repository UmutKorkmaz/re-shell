import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readJsonSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  WorkspaceStateManager,
  WorkspaceCacheManager,
  createWorkspaceStateManager,
  createWorkspaceCacheManager,
} from '../../src/utils/workspace-state';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'reshell-state-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

// --- WorkspaceStateManager ---

describe('WorkspaceStateManager', () => {
  it('should create default state on first load', async () => {
    const dir = makeTempDir();
    const manager = new WorkspaceStateManager(dir);
    const state = await manager.loadState();

    expect(state.version).toBe('1.0.0');
    expect(state.workspaces).toEqual({});
    expect(existsSync(join(dir, '.re-shell', 'state.json'))).toBe(true);
  });

  it('should persist and reload state', async () => {
    const dir = makeTempDir();

    const manager1 = new WorkspaceStateManager(dir);
    await manager1.loadState();
    await manager1.updateWorkspaceState('app-a', { buildStatus: 'success' });
    await manager1.saveState();

    const manager2 = new WorkspaceStateManager(dir);
    const state = await manager2.loadState();

    expect(state.workspaces['app-a']).toBeDefined();
    expect(state.workspaces['app-a'].buildStatus).toBe('success');
  });

  it('should get workspace state by name', async () => {
    const dir = makeTempDir();
    const manager = new WorkspaceStateManager(dir);
    await manager.loadState();
    await manager.updateWorkspaceState('ws-x', { healthScore: 85 });

    const state = manager.getWorkspaceState('ws-x');
    expect(state).toBeDefined();
    expect(state!.healthScore).toBe(85);
  });

  it('should return undefined for unknown workspace', async () => {
    const dir = makeTempDir();
    const manager = new WorkspaceStateManager(dir);
    await manager.loadState();

    expect(manager.getWorkspaceState('nonexistent')).toBeUndefined();
  });

  it('should detect workspace changes via file hashes', async () => {
    const dir = makeTempDir();
    const wsDir = join(dir, 'ws-a');
    mkdirSync(wsDir, { recursive: true });
    writeFileSync(join(wsDir, 'index.ts'), 'export {}');

    const manager = new WorkspaceStateManager(dir);
    await manager.loadState();
    await manager.updateFileHashes('ws-a', wsDir);

    // No change → should report unchanged
    const changed1 = await manager.hasWorkspaceChanged('ws-a', wsDir);
    expect(changed1).toBe(false);

    // Modify file → should report changed
    writeFileSync(join(wsDir, 'index.ts'), 'export const x = 1;');
    const changed2 = await manager.hasWorkspaceChanged('ws-a', wsDir);
    expect(changed2).toBe(true);
  });

  it('should report changed when workspace state does not exist', async () => {
    const dir = makeTempDir();
    const wsDir = join(dir, 'ws-b');
    mkdirSync(wsDir, { recursive: true });
    writeFileSync(join(wsDir, 'index.ts'), 'export {}');

    const manager = new WorkspaceStateManager(dir);
    await manager.loadState();

    const changed = await manager.hasWorkspaceChanged('ws-b', wsDir);
    expect(changed).toBe(true);
  });

  it('should clear state', async () => {
    const dir = makeTempDir();
    const manager = new WorkspaceStateManager(dir);
    await manager.loadState();
    await manager.updateWorkspaceState('to-clear', { buildStatus: 'success' });
    await manager.clearState();

    expect(manager.getWorkspaceState('to-clear')).toBeUndefined();
  });

  it('should backup and restore state', async () => {
    const dir = makeTempDir();
    const manager = new WorkspaceStateManager(dir);
    await manager.loadState();
    await manager.updateWorkspaceState('backup-test', { buildStatus: 'success' });
    await manager.saveState();

    const backupPath = await manager.backupState('test-backup.json');
    expect(existsSync(backupPath)).toBe(true);

    // Clear and restore
    await manager.clearState();
    expect(manager.getWorkspaceState('backup-test')).toBeUndefined();

    await manager.restoreState(backupPath);
    expect(manager.getWorkspaceState('backup-test')).toBeDefined();
    expect(manager.getWorkspaceState('backup-test')!.buildStatus).toBe('success');
  });

  it('should compute state statistics', async () => {
    const dir = makeTempDir();
    const manager = new WorkspaceStateManager(dir);
    await manager.loadState();
    await manager.updateWorkspaceState('ws-1', {});
    await manager.updateWorkspaceState('ws-2', {});

    const stats = manager.getStateStatistics();
    expect(stats.workspaceCount).toBe(2);
    expect(stats.stateFileSize).toBeGreaterThan(0);
  });

  it('should throw on restore from missing backup', async () => {
    const dir = makeTempDir();
    const manager = new WorkspaceStateManager(dir);
    await manager.loadState();

    await expect(manager.restoreState('/nonexistent/backup.json')).rejects.toThrow();
  });
});

// --- WorkspaceCacheManager ---

describe('WorkspaceCacheManager', () => {
  it('should init and create cache directory', async () => {
    const dir = makeTempDir();
    const cache = new WorkspaceCacheManager(dir);
    await cache.init();

    expect(existsSync(join(dir, '.re-shell', 'cache'))).toBe(true);
  });

  it('should set and get values', async () => {
    const dir = makeTempDir();
    const cache = new WorkspaceCacheManager(dir);
    await cache.init();

    await cache.set('key1', { value: 42 });
    const result = await cache.get('key1');
    expect(result).toEqual({ value: 42 });
  });

  it('should return null for missing keys', async () => {
    const dir = makeTempDir();
    const cache = new WorkspaceCacheManager(dir);
    await cache.init();

    const result = await cache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should respect TTL expiration', async () => {
    const dir = makeTempDir();
    const cache = new WorkspaceCacheManager(dir);
    await cache.init();

    // Set with very short TTL
    await cache.set('ephemeral', 'data', 1); // 1ms TTL

    // Wait for it to expire
    await new Promise(r => setTimeout(r, 10));

    const result = await cache.get('ephemeral');
    expect(result).toBeNull();
  });

  it('should not expire entries without TTL', async () => {
    const dir = makeTempDir();
    const cache = new WorkspaceCacheManager(dir);
    await cache.init();

    await cache.set('permanent', 'forever');
    await new Promise(r => setTimeout(r, 10));

    const result = await cache.get('permanent');
    expect(result).toBe('forever');
  });

  it('should invalidate by key', async () => {
    const dir = makeTempDir();
    const cache = new WorkspaceCacheManager(dir);
    await cache.init();

    await cache.set('to-invalidate', 'data');
    await cache.invalidate('to-invalidate');

    const result = await cache.get('to-invalidate');
    expect(result).toBeNull();
  });

  it('should invalidate by pattern', async () => {
    const dir = makeTempDir();
    const cache = new WorkspaceCacheManager(dir);
    await cache.init();

    await cache.set('build:app-a', '1');
    await cache.set('build:app-b', '2');
    await cache.set('test:app-a', '3');

    const count = await cache.invalidatePattern(/^build:/);
    expect(count).toBeGreaterThan(0);

    expect(await cache.get('build:app-a')).toBeNull();
    expect(await cache.get('build:app-b')).toBeNull();
    expect(await cache.get('test:app-a')).toBe('3');
  });

  it('should clear all entries', async () => {
    const dir = makeTempDir();
    const cache = new WorkspaceCacheManager(dir);
    await cache.init();

    await cache.set('a', 1);
    await cache.set('b', 2);
    await cache.clear();

    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBeNull();
  });

  it('should track hit/miss statistics', async () => {
    const dir = makeTempDir();
    const cache = new WorkspaceCacheManager(dir);
    await cache.init();

    await cache.set('hit-key', 'val');
    await cache.get('hit-key'); // hit
    await cache.get('hit-key'); // hit
    await cache.get('miss-key'); // miss

    const stats = cache.getCacheStatistics();
    expect(stats.hitRate).toBeGreaterThan(0);
    expect(stats.missRate).toBeGreaterThan(0);
    expect(stats.hitRate + stats.missRate).toBeCloseTo(1);
  });

  it('should remove expired entries during optimize', async () => {
    const dir = makeTempDir();
    const cache = new WorkspaceCacheManager(dir);
    await cache.init();

    await cache.set('expired', 'old', 1); // 1ms TTL
    await cache.set('valid', 'new');

    await new Promise(r => setTimeout(r, 10));

    const result = await cache.optimize();
    expect(result.removedEntries).toBeGreaterThanOrEqual(1);

    expect(await cache.get('valid')).toBe('new');
  });

  it('should persist across instances', async () => {
    const dir = makeTempDir();

    const cache1 = new WorkspaceCacheManager(dir);
    await cache1.init();
    await cache1.set('persist', 'value');

    const cache2 = new WorkspaceCacheManager(dir);
    await cache2.init();
    const result = await cache2.get('persist');
    expect(result).toBe('value');
  });
});

// --- Factory functions ---

describe('createWorkspaceStateManager', () => {
  it('should create and load state', async () => {
    const dir = makeTempDir();
    const manager = await createWorkspaceStateManager(dir);
    expect(manager.getWorkspaceState('test')).toBeUndefined();
  });
});

describe('createWorkspaceCacheManager', () => {
  it('should create and init cache', async () => {
    const dir = makeTempDir();
    const cache = await createWorkspaceCacheManager(dir);
    await cache.set('factory-test', 'ok');
    expect(await cache.get('factory-test')).toBe('ok');
  });
});
