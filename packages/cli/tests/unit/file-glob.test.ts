import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fg, { type FileGlobOptions } from '../../src/utils/file-glob';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-file-glob-'));
  for (const file of ['root.txt', '.hidden.txt', 'src/index.ts', 'src/a.ts', 'src/deep/b.ts', 'src/deep/lower/c.ts', 'dist/out.js']) {
    const name = path.join(root, file);
    fs.mkdirSync(path.dirname(name), { recursive: true });
    fs.writeFileSync(name, file);
  }
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

async function results(patterns: string | string[], options: FileGlobOptions = {}) {
  const settings = { cwd: root, ...options };
  const sync = fg.sync(patterns, settings).sort();
  expect((await fg(patterns, settings)).sort()).toEqual(sync);
  return sync;
}

describe('file collector', () => {
  it('collects files without directory entries', async () => {
    expect(await results('**/*')).toEqual(['dist/out.js', 'root.txt', 'src/a.ts', 'src/deep/b.ts', 'src/deep/lower/c.ts', 'src/index.ts']);
  });
  it('honors brace alternatives and exclusions with deduplication', async () => {
    expect(await results(['src/**/*.{ts,js}', 'src/*.ts', '!src/deep/**'])).toEqual(['src/a.ts', 'src/index.ts']);
  });
  it('keeps leading negative extglobs as positive pattern expressions', async () => {
    fs.writeFileSync(path.join(root, 'README.md'), 'readme');
    expect(await results('!(*.txt)')).toEqual(['README.md']);
  });
  it('returns deterministic filename order for evidence selection', async () => {
    expect(fg.sync('src/*.ts', { cwd: root })).toEqual(['src/a.ts', 'src/index.ts']);
    expect(await fg('src/*.ts', { cwd: root })).toEqual(['src/a.ts', 'src/index.ts']);
  });
  it('honors ignore and dot-file selection', async () => {
    expect(await results('**/*', { dot: true, ignore: ['src/**', 'dist/**'] })).toEqual(['.hidden.txt', 'root.txt']);
  });
  it('returns absolute paths when requested', async () => {
    expect(await results('src/*.ts', { absolute: true })).toEqual([path.join(root, 'src/a.ts'), path.join(root, 'src/index.ts')]);
  });
  it.each([0, 1, 2, 3])('bounds traversal depth %s from the static pattern directory', async deep => {
    const expected = deep <= 1 ? ['src/a.ts', 'src/index.ts'] : deep === 2 ? ['src/a.ts', 'src/deep/b.ts', 'src/index.ts'] : ['src/a.ts', 'src/deep/b.ts', 'src/deep/lower/c.ts', 'src/index.ts'];
    expect(await results('src/**/*.ts', { deep })).toEqual(expected);
  });
  it('honors deep traversal for root patterns and literal files', async () => {
    expect(await results('**/*.ts', { deep: 1 })).toEqual([]);
    expect(await results('src/deep/b.ts', { deep: 1 })).toEqual(['src/deep/b.ts']);
  });
  it('handles empty and entirely negative selections', async () => {
    expect(await results([])).toEqual([]);
    expect(await results(['!src/**'])).toEqual([]);
  });
  it('includes directories only when explicitly requested', async () => {
    expect(await results('src/*', { onlyFiles: false })).toEqual(['src/a.ts', 'src/deep', 'src/index.ts']);
  });
  it('does not change the process working directory', async () => {
    const cwd = process.cwd();
    await results('src/*.ts');
    expect(process.cwd()).toBe(cwd);
  });
  it('excludes symlink files and symlink traversal for cache collection', async () => {
    if (process.platform === 'win32') return; // Creating symlinks needs privileges on Windows.
    fs.symlinkSync(path.join(root, 'root.txt'), path.join(root, 'link.txt'));
    fs.symlinkSync(path.join(root, 'src'), path.join(root, 'linked-src'), 'dir');
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-file-glob-outside-'));
    try {
      fs.writeFileSync(path.join(outside, 'outside.txt'), 'outside');
      fs.symlinkSync(outside, path.join(root, 'outside'), 'dir');
      const matches = await results('**/*', { followSymbolicLinks: false });
      expect(matches).not.toContain('link.txt');
      expect(matches.some(name => name.startsWith('linked-src/') || name.startsWith('outside/'))).toBe(false);
      expect(await results('linked-src/*.ts', { followSymbolicLinks: false })).toEqual([]);
      expect(await results('link.txt', { followSymbolicLinks: false })).toEqual([]);
      expect(await results('linked-src/*.ts')).toEqual(['linked-src/a.ts', 'linked-src/index.ts']);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
  it('handles deeply nested brace input without recursive parser stack exhaustion', async () => {
    const pattern = '{'.repeat(2000) + 'root.txt' + '}'.repeat(2000);
    expect(await results(pattern)).toEqual([]);
  });
});
