import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  ChangeDetector,
  createChangeDetector,
  detectChanges,
  hasFileChanged,
} from '../../src/utils/change-detector';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'reshell-changedet-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function createFixture(dir: string, files: Record<string, string>): void {
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content);
  }
}

describe('ChangeDetector', () => {
  describe('getFileHash', () => {
    it('should hash a file and return a FileHash', async () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, 'test.ts'), 'export const x = 1;');
      const detector = new ChangeDetector(dir, { enableCache: false });

      const hash = await detector.getFileHash('test.ts');
      expect(hash).not.toBeNull();
      expect(hash!.path).toBe('test.ts');
      expect(hash!.hash).toMatch(/^[0-9a-f]+$/);
      expect(hash!.type).toBe('file');
    });

    it('should return null for nonexistent file', async () => {
      const dir = makeTempDir();
      const detector = new ChangeDetector(dir, { enableCache: false });

      const hash = await detector.getFileHash('nonexistent.ts');
      expect(hash).toBeNull();
    });

    it('should return empty hash for directories', async () => {
      const dir = makeTempDir();
      mkdirSync(join(dir, 'subdir'));
      const detector = new ChangeDetector(dir, { enableCache: false });

      const hash = await detector.getFileHash('subdir');
      expect(hash).not.toBeNull();
      expect(hash!.hash).toBe('');
      expect(hash!.type).toBe('directory');
    });

    it('should produce different hashes for different content', async () => {
      const dir1 = makeTempDir();
      writeFileSync(join(dir1, 'f.ts'), 'content-a');
      const d1 = new ChangeDetector(dir1, { enableCache: false });
      const h1 = await d1.getFileHash('f.ts');

      const dir2 = makeTempDir();
      writeFileSync(join(dir2, 'f.ts'), 'content-b');
      const d2 = new ChangeDetector(dir2, { enableCache: false });
      const h2 = await d2.getFileHash('f.ts');

      expect(h1!.hash).not.toBe(h2!.hash);
    });

    it('should produce same hash for identical content', async () => {
      const dir1 = makeTempDir();
      writeFileSync(join(dir1, 'f.ts'), 'identical');
      const d1 = new ChangeDetector(dir1, { enableCache: false });
      const h1 = await d1.getFileHash('f.ts');

      const dir2 = makeTempDir();
      writeFileSync(join(dir2, 'f.ts'), 'identical');
      const d2 = new ChangeDetector(dir2, { enableCache: false });
      const h2 = await d2.getFileHash('f.ts');

      expect(h1!.hash).toBe(h2!.hash);
    });
  });

  describe('detectChanges', () => {
    it('should throw on nonexistent path', async () => {
      const dir = makeTempDir();
      const detector = new ChangeDetector(dir, { enableCache: false });

      await expect(detector.detectChanges('nonexistent')).rejects.toThrow();
    });

    it('should detect all files as added on first scan', async () => {
      const dir = makeTempDir();
      createFixture(dir, { 'a.ts': 'a', 'b.ts': 'b' });
      const detector = new ChangeDetector(dir, { enableCache: false });

      const result = await detector.detectChanges();

      expect(result.totalChanges).toBeGreaterThan(0);
      expect(result.added.length).toBeGreaterThan(0);
      expect(result.modified).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
    });

    it('should detect no changes on second identical scan', async () => {
      const dir = makeTempDir();
      createFixture(dir, { 'a.ts': 'a', 'b.ts': 'b' });
      const detector = new ChangeDetector(dir, { enableCache: false });

      await detector.detectChanges();
      const result = await detector.detectChanges();

      expect(result.totalChanges).toBe(0);
      expect(result.added).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
    });

    it('should detect modified files', async () => {
      const dir = makeTempDir();
      createFixture(dir, { 'a.ts': 'original' });
      const detector = new ChangeDetector(dir, { enableCache: false });

      await detector.detectChanges();
      writeFileSync(join(dir, 'a.ts'), 'modified');
      const result = await detector.detectChanges();

      expect(result.modified.length).toBeGreaterThan(0);
    });

    it('should detect deleted files', async () => {
      const dir = makeTempDir();
      createFixture(dir, { 'a.ts': 'a', 'b.ts': 'b' });
      const detector = new ChangeDetector(dir, { enableCache: false });

      await detector.detectChanges();
      unlinkSync(join(dir, 'b.ts'));
      const result = await detector.detectChanges();

      expect(result.deleted.some(d => d.includes('b.ts'))).toBe(true);
    });

    it('should detect added files', async () => {
      const dir = makeTempDir();
      createFixture(dir, { 'a.ts': 'a' });
      const detector = new ChangeDetector(dir, { enableCache: false });

      await detector.detectChanges();
      writeFileSync(join(dir, 'new.ts'), 'new');
      const result = await detector.detectChanges();

      expect(result.added.some(f => f.includes('new.ts'))).toBe(true);
    });

    it('should report scanTime and hashingTime', async () => {
      const dir = makeTempDir();
      createFixture(dir, { 'a.ts': 'a' });
      const detector = new ChangeDetector(dir, { enableCache: false });

      const result = await detector.detectChanges();

      expect(result.scanTime).toBeGreaterThanOrEqual(0);
      expect(result.hashingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('hasFileChanged', () => {
    it('should return true for newly added file', async () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, 'f.ts'), 'content');
      const detector = new ChangeDetector(dir, { enableCache: false });

      // No previous scan → should be considered changed
      const changed = await detector.hasFileChanged('f.ts');
      expect(changed).toBe(true);
    });

    it('should return false for unchanged file after scan', async () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, 'f.ts'), 'content');
      const detector = new ChangeDetector(dir, { enableCache: false });

      await detector.detectChanges();
      const changed = await detector.hasFileChanged('f.ts');
      expect(changed).toBe(false);
    });

    it('should return true for modified file after cache clear', async () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, 'f.ts'), 'original content here');
      const detector = new ChangeDetector(dir, { enableCache: false });

      await detector.detectChanges();
      writeFileSync(join(dir, 'f.ts'), 'modified content here!!!');

      // Clear cache so the next getFileHash recomputes the hash
      await detector.clearCache();
      const changed = await detector.hasFileChanged('f.ts');
      expect(changed).toBe(true);
    });
  });

  describe('exclude patterns', () => {
    it('should exclude node_modules by default', async () => {
      const dir = makeTempDir();
      createFixture(dir, {
        'src/a.ts': 'a',
        'node_modules/pkg/index.js': 'dep',
      });
      const detector = new ChangeDetector(dir, { enableCache: false });

      const result = await detector.detectChanges();

      expect(result.added.some(f => f.includes('src/a.ts'))).toBe(true);
      expect(result.added.some(f => f.includes('node_modules'))).toBe(false);
    });

    it('should exclude dist by default', async () => {
      const dir = makeTempDir();
      createFixture(dir, {
        'src/a.ts': 'a',
        'dist/bundle.js': 'built',
      });
      const detector = new ChangeDetector(dir, { enableCache: false });

      const result = await detector.detectChanges();

      expect(result.added.some(f => f.includes('dist'))).toBe(false);
    });
  });

  describe('metadata-only hashing', () => {
    it('should produce hashes using metadata-only mode', async () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, 'f.ts'), 'content');
      const detector = new ChangeDetector(dir, {
        enableCache: false,
        useContentHashing: false,
        useMetadataOnly: true,
      });

      const hash = await detector.getFileHash('f.ts');
      expect(hash).not.toBeNull();
      expect(hash!.hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics after scanning', async () => {
      const dir = makeTempDir();
      createFixture(dir, { 'a.ts': 'a', 'b.ts': 'b' });
      const detector = new ChangeDetector(dir, { enableCache: false });

      await detector.detectChanges();
      const stats = detector.getCacheStats();

      expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
      expect(stats.totalFiles).toBeGreaterThanOrEqual(0);
      expect(typeof stats.memoryUsage).toBe('string');
    });
  });

  describe('clearCache', () => {
    it('should clear in-memory caches', async () => {
      const dir = makeTempDir();
      createFixture(dir, { 'a.ts': 'a' });
      const detector = new ChangeDetector(dir, { enableCache: false });

      await detector.detectChanges();
      await detector.clearCache();

      const stats = detector.getCacheStats();
      expect(stats.cacheSize).toBe(0);
    });
  });
});

describe('createChangeDetector', () => {
  it('should create and initialize detector', async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'f.ts'), 'content');

    const detector = await createChangeDetector(dir, { enableCache: false });
    const result = await detector.detectChanges();

    expect(result.added.length).toBeGreaterThan(0);
  });
});

describe('detectChanges (convenience)', () => {
  it('should run a single detection scan', async () => {
    const dir = makeTempDir();
    createFixture(dir, { 'a.ts': 'a' });

    const result = await detectChanges(dir, { enableCache: false });
    expect(result.added.length).toBeGreaterThan(0);
  });
});

describe('hasFileChanged (convenience)', () => {
  it('should check if a file changed without prior scan', async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'f.ts'), 'content');

    const changed = await hasFileChanged(dir, 'f.ts', { enableCache: false });
    expect(changed).toBe(true);
  });
});
