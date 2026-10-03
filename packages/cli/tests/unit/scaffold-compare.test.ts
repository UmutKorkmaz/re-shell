import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import {
  compareScaffoldToDisk,
  readTree,
  touchedFiles,
  toPosix,
  withScratchDir,
} from '../../src/utils/scaffold-compare';

describe('scaffold-compare', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'scaffold-compare-'));
  });

  afterEach(async () => {
    await fs.remove(root);
  });

  describe('compareScaffoldToDisk', () => {
    it('reports every file as added when there is nothing to compare against', () => {
      const result = compareScaffoldToDisk(
        [
          { path: 'b.txt', content: 'bee' },
          { path: 'a.txt', content: 'ay' },
        ],
        null
      );
      expect(result.files.map(f => f.path)).toEqual(['a.txt', 'b.txt']);
      expect(result.files.every(f => f.status === 'added' && f.action === 'create')).toBe(true);
      expect(result.summary).toEqual({ added: 2, modified: 0, unchanged: 0 });
      expect(result.totalBytes).toBe(5);
    });

    it('reports every file as added when the target directory does not exist', () => {
      const result = compareScaffoldToDisk([{ path: 'x/y.txt', content: 'hi' }], path.join(root, 'nope'));
      expect(result.files[0]).toMatchObject({ status: 'added', action: 'create', bytes: 2 });
      expect(result.files[0].diff).toBeUndefined();
    });

    it('classifies added, modified and unchanged files against an existing target', async () => {
      await fs.outputFile(path.join(root, 'same.txt'), 'same\n');
      await fs.outputFile(path.join(root, 'changed.txt'), 'old line\nkeep\n');

      const result = compareScaffoldToDisk(
        [
          { path: 'same.txt', content: 'same\n' },
          { path: 'changed.txt', content: 'new line\nkeep\n' },
          { path: 'fresh.txt', content: 'fresh\n' },
        ],
        root
      );

      const byPath = Object.fromEntries(result.files.map(f => [f.path, f]));
      expect(byPath['same.txt']).toMatchObject({ status: 'unchanged', action: 'unchanged' });
      expect(byPath['fresh.txt']).toMatchObject({ status: 'added', action: 'create' });
      expect(byPath['changed.txt']).toMatchObject({ status: 'modified', action: 'overwrite' });
      expect(result.summary).toEqual({ added: 1, modified: 1, unchanged: 1 });
    });

    it('attaches a unified diff (existing -> scaffolded) only to modified files', async () => {
      await fs.outputFile(path.join(root, 'app.ts'), 'const a = 1;\nconst b = 2;\n');
      const result = compareScaffoldToDisk(
        [
          { path: 'app.ts', content: 'const a = 1;\nconst b = 3;\n' },
          { path: 'other.ts', content: 'x\n' },
        ],
        root
      );
      const modified = result.files.find(f => f.path === 'app.ts');
      expect(modified?.diff).toContain('--- a/app.ts');
      expect(modified?.diff).toContain('+++ b/app.ts');
      expect(modified?.diff).toContain('-const b = 2;');
      expect(modified?.diff).toContain('+const b = 3;');
      expect(result.files.find(f => f.path === 'other.ts')?.diff).toBeUndefined();
    });

    it('compares nested paths and treats a directory in the way as not-a-file (added)', async () => {
      await fs.ensureDir(path.join(root, 'dir.txt'));
      const result = compareScaffoldToDisk(
        [
          { path: 'dir.txt', content: 'x' },
          { path: 'deep/er/file.txt', content: 'y' },
        ],
        root
      );
      expect(result.files.map(f => f.status)).toEqual(['added', 'added']);
    });

    it('truncates previews to the limit with an ellipsis', () => {
      const result = compareScaffoldToDisk([{ path: 'big.txt', content: 'x'.repeat(50) }], null, {
        previewLimit: 10,
      });
      expect(result.previews['big.txt']).toBe('x'.repeat(10) + '…');
      const short = compareScaffoldToDisk([{ path: 's.txt', content: 'tiny' }], null, { previewLimit: 10 });
      expect(short.previews['s.txt']).toBe('tiny');
    });

    it('never writes anything', async () => {
      await fs.outputFile(path.join(root, 'keep.txt'), 'original');
      compareScaffoldToDisk([{ path: 'keep.txt', content: 'different' }, { path: 'new.txt', content: 'n' }], root);
      expect(await fs.readFile(path.join(root, 'keep.txt'), 'utf8')).toBe('original');
      expect(await fs.pathExists(path.join(root, 'new.txt'))).toBe(false);
    });
  });

  describe('readTree / touchedFiles', () => {
    it('reads files recursively as forward-slashed paths and skips node_modules and .git', async () => {
      await fs.outputFile(path.join(root, 'a.txt'), 'a');
      await fs.outputFile(path.join(root, 'sub/b.txt'), 'b');
      await fs.outputFile(path.join(root, 'node_modules/pkg/index.js'), 'skip');
      await fs.outputFile(path.join(root, '.git/HEAD'), 'skip');

      const tree = readTree(root);
      expect([...tree.keys()].sort()).toEqual(['a.txt', 'sub/b.txt']);
      expect(tree.get('sub/b.txt')).toBe('b');
    });

    it('returns an empty tree for a missing directory', () => {
      expect(readTree(path.join(root, 'missing')).size).toBe(0);
    });

    it('lists only new or changed files', () => {
      const before = new Map([
        ['same.txt', '1'],
        ['edited.txt', 'old'],
      ]);
      const after = new Map([
        ['same.txt', '1'],
        ['edited.txt', 'new'],
        ['added.txt', 'x'],
      ]);
      expect(touchedFiles(before, after)).toEqual([
        { path: 'added.txt', content: 'x' },
        { path: 'edited.txt', content: 'new' },
      ]);
    });
  });

  describe('withScratchDir', () => {
    it('provides a fresh directory and removes it afterwards', async () => {
      let seen = '';
      const result = await withScratchDir('scratch-test-', async scratch => {
        seen = scratch;
        expect(await fs.pathExists(scratch)).toBe(true);
        await fs.outputFile(path.join(scratch, 'f.txt'), 'x');
        return 42;
      });
      expect(result).toBe(42);
      expect(await fs.pathExists(seen)).toBe(false);
    });

    it('removes the directory even when the callback throws', async () => {
      let seen = '';
      await expect(
        withScratchDir('scratch-test-', async scratch => {
          seen = scratch;
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');
      expect(await fs.pathExists(seen)).toBe(false);
    });
  });

  it('toPosix converts the native separator to forward slashes', () => {
    expect(toPosix(['a', 'b', 'c.txt'].join(path.sep))).toBe('a/b/c.txt');
  });
});
