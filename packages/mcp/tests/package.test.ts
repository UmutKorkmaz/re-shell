import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCli } from '../src/cli.js';

/**
 * Package metadata + published-artifact checks for @re-shell/mcp.
 *
 * Two shipping defects are pinned here:
 *   - the server spawns the re-shell CLI at runtime but declared neither a
 *     dependency nor a peer on it, so a standalone `npx @re-shell/mcp` died with
 *     "Unable to resolve the @re-shell/cli entry";
 *   - the tarball shipped compiled test files (dist/*.test.js, *.test.d.ts).
 */

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
  peerDependencies?: Record<string, string>;
  bin: Record<string, string>;
  files: string[];
};

describe('runtime dependency on the CLI', () => {
  it('declares @re-shell/cli as a dependency, as workspace:^ so publishing rewrites it to a caret range', () => {
    expect(pkg.dependencies['@re-shell/cli']).toBe('workspace:^');
  });

  it('declares @re-shell/contracts the same way', () => {
    expect(pkg.dependencies['@re-shell/contracts']).toBe('workspace:^');
  });

  it('does not rely on an undeclared peer', () => {
    expect(pkg.peerDependencies?.['@re-shell/cli']).toBeUndefined();
  });

  describe('resolveCli()', () => {
    const original = process.env.RE_SHELL_BIN;
    afterEach(() => {
      if (original === undefined) delete process.env.RE_SHELL_BIN;
      else process.env.RE_SHELL_BIN = original;
    });

    it('resolves the declared dependency via require.resolve (not the monorepo-relative fallback)', () => {
      delete process.env.RE_SHELL_BIN;
      const invocation = resolveCli();
      expect(invocation.strategy).toBe('require.resolve');
      // It lands on the CLI package's built entry...
      expect(fs.realpathSync(invocation.entry)).toBe(
        fs.realpathSync(path.resolve(PKG_ROOT, '..', 'cli', 'dist', 'index.js'))
      );
      // ...reached through THIS package's own node_modules, i.e. through the dependency.
      expect(
        fs.existsSync(path.join(PKG_ROOT, 'node_modules', '@re-shell', 'cli', 'package.json'))
      ).toBe(true);
    });

    it('still lets RE_SHELL_BIN override the dependency', () => {
      process.env.RE_SHELL_BIN = path.resolve(PKG_ROOT, '..', 'cli', 'dist', 'index.js');
      expect(resolveCli().strategy).toBe('RE_SHELL_BIN');
    });
  });
});

describe('published tarball', () => {
  // `npm pack --dry-run` runs the same file selection as a real publish (the
  // `files` field, minus negations) without writing anything.
  const listing = JSON.parse(
    execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd: PKG_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: process.platform === 'win32',
    })
  ) as Array<{ files: Array<{ path: string }> }>;
  const files = listing[0].files.map((f) => f.path);

  it('ships the built entry, its modules and the README', () => {
    expect(files).toContain('dist/index.js');
    expect(files).toContain('dist/index.d.ts');
    expect(files).toContain('dist/entry.js');
    expect(files).toContain('dist/cli.js');
    expect(files).toContain('dist/tools.js');
    expect(files).toContain('README.md');
    expect(files).toContain('package.json');
  });

  it('ships no test files (compiled tests, declarations of tests, or sources)', () => {
    const tests = files.filter((f) => /\.(test|spec)\.[cm]?[jt]s$|\.test\.d\.ts$|\.test\.js\.map$/.test(f));
    expect(tests).toEqual([]);
    expect(files.some((f) => f.startsWith('tests/') || f.startsWith('src/'))).toBe(false);
  });

  it('the bin target is in the tarball and starts with a node shebang', () => {
    const target = pkg.bin['re-shell-mcp'].replace(/^\.\//, '');
    expect(files).toContain(target);
    const head = fs.readFileSync(path.join(PKG_ROOT, target), 'utf8').split('\n', 1)[0];
    expect(head).toBe('#!/usr/bin/env node');
  });
});

describe('build output', () => {
  it('contains no compiled test files', () => {
    const dist = path.join(PKG_ROOT, 'dist');
    const leftovers = fs.readdirSync(dist).filter((f) => /\.test\./.test(f));
    expect(leftovers).toEqual([]);
  });
});
