import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMainEntry } from './entry.js';

/**
 * `isMainEntry` decides whether `dist/index.js` should start the stdio server.
 * The regression: the installed bin is a SYMLINK (`node_modules/.bin/re-shell-mcp`)
 * and Node reports it as `process.argv[1]`, while `import.meta.url` is the real
 * file. The old lexical comparison was false for every installed invocation, so
 * `npx @re-shell/mcp` exited 0 without serving anything.
 */
describe('isMainEntry', () => {
  let tmp: string;
  let realFile: string;
  let otherFile: string;
  let binLink: string;
  let chainedLink: string;

  beforeAll(() => {
    // realpath the tmp root so the expectations hold on macOS (/var -> /private/var).
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-entry-')));
    const dist = path.join(tmp, 'pkg', 'dist');
    fs.mkdirSync(dist, { recursive: true });
    realFile = path.join(dist, 'index.js');
    otherFile = path.join(dist, 'other.js');
    fs.writeFileSync(realFile, '// entry\n');
    fs.writeFileSync(otherFile, '// other\n');

    const bin = path.join(tmp, 'node_modules', '.bin');
    fs.mkdirSync(bin, { recursive: true });
    binLink = path.join(bin, 're-shell-mcp');
    fs.symlinkSync(realFile, binLink);
    // A symlink to the symlink (e.g. a global install behind a version manager).
    chainedLink = path.join(tmp, 'global-re-shell-mcp');
    fs.symlinkSync(binLink, chainedLink);
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('is true when argv[1] is the module file itself', () => {
    expect(isMainEntry(realFile, pathToFileURL(realFile).href)).toBe(true);
  });

  it('is true when argv[1] is the installed bin SYMLINK (the regression)', () => {
    expect(isMainEntry(binLink, pathToFileURL(realFile).href)).toBe(true);
  });

  it('is true through a chain of symlinks', () => {
    expect(isMainEntry(chainedLink, pathToFileURL(realFile).href)).toBe(true);
  });

  it('is true for a relative spelling that has to be resolved', () => {
    const relative = path.relative(process.cwd(), realFile);
    expect(isMainEntry(relative, pathToFileURL(realFile).href)).toBe(true);
  });

  it('accepts argv[1] without the .js extension (`node dist/index`)', () => {
    expect(isMainEntry(realFile.replace(/\.js$/, ''), pathToFileURL(realFile).href)).toBe(true);
  });

  it('is false when the module is imported by some other entry point', () => {
    expect(isMainEntry(otherFile, pathToFileURL(realFile).href)).toBe(false);
    expect(isMainEntry(process.argv[1], pathToFileURL(realFile).href)).toBe(false);
  });

  it('is false when a symlink points at a different file', () => {
    const wrongLink = path.join(tmp, 'wrong-link');
    fs.symlinkSync(otherFile, wrongLink);
    expect(isMainEntry(wrongLink, pathToFileURL(realFile).href)).toBe(false);
  });

  it('is false when argv[1] is missing or does not exist', () => {
    expect(isMainEntry(undefined, pathToFileURL(realFile).href)).toBe(false);
    expect(isMainEntry('', pathToFileURL(realFile).href)).toBe(false);
    expect(isMainEntry(path.join(tmp, 'nope.js'), pathToFileURL(realFile).href)).toBe(false);
  });

  it('is false for a dangling symlink and for a module URL that is not a file', () => {
    const dangling = path.join(tmp, 'dangling');
    fs.symlinkSync(path.join(tmp, 'gone.js'), dangling);
    expect(isMainEntry(dangling, pathToFileURL(realFile).href)).toBe(false);
    expect(isMainEntry(realFile, 'https://example.com/index.js')).toBe(false);
    expect(isMainEntry(realFile, 'not a url')).toBe(false);
  });
});
