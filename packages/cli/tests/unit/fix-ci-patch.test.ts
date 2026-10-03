import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { proposeAndApply, buildPrompt, collectContextFiles, rollbackPatch, SYSTEM_PROMPT } from '../../src/fix-ci/applier';
import {
  extractPatch,
  globToRegExp,
  packageJsonGuard,
  pathViolation,
  validatePatch,
  type PatchValidationContext,
} from '../../src/fix-ci/patch';
import { DEFAULT_PATCH_LIMITS } from '../../src/fix-ci/types';
import {
  FAST_GATES,
  FILES,
  TYPE_ERROR_FIX_PATCH,
  createFixture,
  fakeProvider,
  git,
  replaceLinePatch,
  type Fixture,
} from '../utils/fix-ci-fixture';

let fx: Fixture | undefined;
afterEach(() => {
  fx?.cleanup();
  fx = undefined;
});

function ctxFor(dir: string, over: Partial<PatchValidationContext> = {}): PatchValidationContext {
  return { repoRoot: dir, workspaceRel: '', limits: { ...DEFAULT_PATCH_LIMITS }, protectedGlobs: [], ...over };
}

describe('extractPatch', () => {
  it('strips markdown fences and prose and guarantees a trailing newline', () => {
    const raw = 'Here is the fix:\n```diff\n' + TYPE_ERROR_FIX_PATCH.trimEnd() + '\n```\nDone.';
    expect(extractPatch(raw)).toBe(TYPE_ERROR_FIX_PATCH);
    expect(extractPatch(TYPE_ERROR_FIX_PATCH.trimEnd())).toBe(TYPE_ERROR_FIX_PATCH);
    expect(extractPatch('   ')).toBe('');
  });
});

describe('pathViolation', () => {
  const ctx = ctxFor('/repo');
  it.each([
    'tests/add.test.ts',
    'src/foo.spec.tsx',
    'src/__tests__/a.ts',
    'src/__snapshots__/a.snap',
    'test/helper.ts',
    'pkg/foo_test.go',
    'tests/test_x.py',
    'src/FooTest.java',
    'vitest.config.ts',
    'jest.config.js',
    'tsconfig.json',
    'tsconfig.build.json',
    '.eslintrc.json',
    'eslint.config.mjs',
    '.re-shell/fix-ci.yaml',
    're-shell.workspaces.yaml',
    '.github/workflows/ci.yml',
    'node_modules/x/index.js',
    '.git/config',
    '../outside.ts',
    '/abs/path.ts',
    'src//double.ts',
  ])('forbids %s', p => {
    expect(pathViolation(p, ctx)).not.toBeNull();
  });

  it.each(['src/index.ts', 'src/utils/add.ts', 'lib/contest.ts', 'package.json', 'README.md'])('allows %s', p => {
    expect(pathViolation(p, ctx)).toBeNull();
  });

  it('confines patches to the workspace subdirectory and honours configured globs', () => {
    const sub = ctxFor('/repo', { workspaceRel: 'packages/app', protectedGlobs: ['src/generated/**', '*.lock'] });
    expect(pathViolation('packages/app/src/a.ts', sub)).toBeNull();
    expect(pathViolation('packages/other/src/a.ts', sub)).toMatch(/outside the workspace/);
    expect(pathViolation('src/a.ts', sub)).toMatch(/outside the workspace/);
    expect(pathViolation('packages/app/src/generated/x/y.ts', sub)).toMatch(/protected path/);
    expect(pathViolation('packages/app/yarn.lock', sub)).toMatch(/protected path/);
    expect(pathViolation('packages/app/tests/a.ts', sub)).toMatch(/test file/);
  });

  it('globToRegExp supports **, * and ?', () => {
    expect(globToRegExp('src/**/x.ts').test('src/x.ts')).toBe(true);
    expect(globToRegExp('src/**/x.ts').test('src/a/b/x.ts')).toBe(true);
    expect(globToRegExp('src/*.ts').test('src/a/b.ts')).toBe(false);
    expect(globToRegExp('a?.ts').test('ab.ts')).toBe(true);
  });
});

describe('validatePatch', () => {
  it('accepts a good patch and reports the diffstat as git counts it', async () => {
    fx = createFixture();
    const res = await validatePatch(TYPE_ERROR_FIX_PATCH, ctxFor(fx.dir));
    expect(res).toMatchObject({ ok: true, additions: 1, deletions: 1, files: [{ path: 'src/index.ts', additions: 1, deletions: 1 }] });
    // validation never touches the work tree
    expect(git(fx.dir, 'status', '--porcelain')).toBe('');
  });

  it('tolerates wrong hunk line counts from a model (--recount) but not wrong context', async () => {
    fx = createFixture();
    const sloppy = TYPE_ERROR_FIX_PATCH.replace('@@ -1,3 +1,3 @@', '@@ -1,9 +1,9 @@');
    expect((await validatePatch(sloppy, ctxFor(fx.dir))).ok).toBe(true);
    const wrong = TYPE_ERROR_FIX_PATCH.replace("-export const total: number = add(1, '2');", "-export const total: number = add(7, '7');");
    const res = await validatePatch(wrong, ctxFor(fx.dir));
    expect(res).toMatchObject({ ok: false });
    expect((res as { reason: string }).reason).toMatch(/does not apply cleanly/);
  });

  it('rejects empty, oversized, multi-file-over-limit and non-diff output', async () => {
    fx = createFixture();
    const reason = async (patch: string, over: Partial<PatchValidationContext> = {}): Promise<string> => {
      const r = await validatePatch(patch, ctxFor(fx!.dir, over));
      expect(r.ok).toBe(false);
      return (r as { reason: string }).reason;
    };
    expect(await reason('')).toMatch(/empty patch/);
    expect(await reason('just some prose, no diff')).toMatch(/empty patch|not a unified diff/);
    expect(await reason(TYPE_ERROR_FIX_PATCH, { limits: { ...DEFAULT_PATCH_LIMITS, maxBytes: 50 } })).toMatch(/limit is 50/);
    expect(await reason(TYPE_ERROR_FIX_PATCH, { limits: { ...DEFAULT_PATCH_LIMITS, maxChangedLines: 1 } })).toMatch(/changes 2 lines; the limit is 1/);
    const two = TYPE_ERROR_FIX_PATCH + replaceLinePatch('src/add.ts', FILES['src/add.ts'], 2, '  return b + a;');
    expect(await reason(two, { limits: { ...DEFAULT_PATCH_LIMITS, maxFiles: 1 } })).toMatch(/2 files; the limit is 1/);
  });

  it('rejects renames, mode changes, binary patches and symlinks', async () => {
    fx = createFixture();
    const rename = 'diff --git a/src/add.ts b/src/sum.ts\nsimilarity index 100%\nrename from src/add.ts\nrename to src/sum.ts\n';
    const mode = 'diff --git a/src/add.ts b/src/add.ts\nold mode 100644\nnew mode 100755\n';
    const binary = 'diff --git a/src/x.bin b/src/x.bin\nnew file mode 100644\nGIT binary patch\nliteral 0\n';
    const symlink = 'diff --git a/src/link b/src/link\nnew file mode 120000\n--- /dev/null\n+++ b/src/link\n@@ -0,0 +1 @@\n+../../etc/passwd\n';
    for (const [patch, re] of [
      [rename, /renames/],
      [mode, /mode changes/],
      [binary, /binary/],
      [symlink, /mode changes and non-regular/],
    ] as const) {
      const r = await validatePatch(patch, ctxFor(fx.dir));
      expect(r.ok).toBe(false);
      expect((r as { reason: string }).reason).toMatch(re);
    }
  });

  it('rejects writes through a symlink that escapes the workspace', async () => {
    fx = createFixture();
    const outside = fs.mkdtempSync(path.join(path.dirname(fx.dir), 'outside-'));
    try {
      fs.symlinkSync(outside, path.join(fx.dir, 'src', 'escape'));
      const patch =
        'diff --git a/src/escape/evil.ts b/src/escape/evil.ts\nnew file mode 100644\n--- /dev/null\n+++ b/src/escape/evil.ts\n@@ -0,0 +1 @@\n+export const x = 1;\n';
      const r = await validatePatch(patch, ctxFor(fx.dir));
      expect(r.ok).toBe(false);
      expect((r as { reason: string }).reason).toMatch(/symlink|beyond a symbolic link/);
      expect(fs.existsSync(path.join(outside, 'evil.ts'))).toBe(false);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('rejects test files, gate configs, and suppression directives', async () => {
    fx = createFixture({ ...FAST_GATES });
    const pkg = FILES['package.json'];
    const cases: Array<[string, RegExp]> = [
      [replaceLinePatch('tests/add.test.ts', FILES['tests/add.test.ts'], 6, '    expect(1).toBe(1);'), /test file/],
      [replaceLinePatch('tsconfig.json', FILES['tsconfig.json'], 6, '    "strict": false,'), /TypeScript config/],
      [replaceLinePatch('.re-shell/fix-ci.yaml', FAST_GATES['.re-shell/fix-ci.yaml'], 1, 'detect: true'), /fix-ci gate config/],
      [replaceLinePatch('src/index.ts', FILES['src/index.ts'], 3, '// @ts-ignore'), /suppression directive/],
      [replaceLinePatch('src/index.ts', FILES['src/index.ts'], 3, '/* eslint-disable */'), /suppression directive/],
      [TYPE_ERROR_FIX_PATCH.replace(/src\/index\.ts/g, '../escape.ts'), /normalised/],
      [TYPE_ERROR_FIX_PATCH.replace(/src\/index\.ts/g, 'src/__tests__/x.ts'), /test file/],
      [TYPE_ERROR_FIX_PATCH.replace(/src\/index\.ts/g, '.git/hooks/pre-commit'), /inside \.git/],
      [pkg ? TYPE_ERROR_FIX_PATCH.replace(/src\/index\.ts/g, 'node_modules/x/index.ts') : '', /node_modules/],
    ];
    for (const [patch, re] of cases) {
      const r = await validatePatch(patch, ctxFor(fx.dir));
      expect(r.ok, patch).toBe(false);
      expect((r as { reason: string }).reason).toMatch(re);
    }
  });

  it('packageJsonGuard allows dependency edits but not script/jest/vitest/eslint changes', () => {
    const base = { name: 'x', scripts: { test: 'vitest run' }, dependencies: { a: '1' } };
    const edit = (patch: object): string => JSON.stringify({ ...base, ...patch });
    expect(packageJsonGuard(JSON.stringify(base), edit({ dependencies: { a: '2' } }))).toBeNull();
    expect(packageJsonGuard(JSON.stringify(base), edit({ scripts: { test: 'true' } }))).toMatch(/"scripts"/);
    expect(packageJsonGuard(JSON.stringify(base), edit({ jest: { testMatch: [] } }))).toMatch(/"jest"/);
    expect(packageJsonGuard(JSON.stringify(base), '{ not json')).toMatch(/no longer valid JSON/);
  });
});

describe('proposeAndApply', () => {
  it('applies a valid patch to the work tree and rollbackPatch restores it exactly', async () => {
    fx = createFixture();
    const before = fs.readFileSync(path.join(fx.dir, 'src/index.ts'), 'utf8');
    const provider = fakeProvider(() => ({ patch: TYPE_ERROR_FIX_PATCH, explanation: 'ok' }));
    const attempt = await proposeAndApply({
      provider,
      gates: [],
      previousAttempts: [],
      workspaceRoot: fx.dir,
      validation: ctxFor(fx.dir),
    });
    expect(attempt.kind).toBe('applied');
    expect(fs.readFileSync(path.join(fx.dir, 'src/index.ts'), 'utf8')).toContain('add(1, 2)');
    await rollbackPatch(fx.dir, (attempt as { patch: string }).patch);
    expect(fs.readFileSync(path.join(fx.dir, 'src/index.ts'), 'utf8')).toBe(before);
    expect(git(fx.dir, 'status', '--porcelain')).toBe('');
  });

  it('applies file creation and deletion and rolls both back', async () => {
    fx = createFixture();
    const patch =
      'diff --git a/src/new.ts b/src/new.ts\nnew file mode 100644\n--- /dev/null\n+++ b/src/new.ts\n@@ -0,0 +1 @@\n+export const n = 1;\n' +
      'diff --git a/src/add.ts b/src/add.ts\ndeleted file mode 100644\n--- a/src/add.ts\n+++ /dev/null\n@@ -1,3 +0,0 @@\n-export function add(a: number, b: number): number {\n-  return a + b;\n-}\n';
    const provider = fakeProvider(() => ({ patch, explanation: 'x' }));
    const attempt = await proposeAndApply({ provider, gates: [], previousAttempts: [], workspaceRoot: fx.dir, validation: ctxFor(fx.dir) });
    expect(attempt.kind).toBe('applied');
    expect(fs.existsSync(path.join(fx.dir, 'src/new.ts'))).toBe(true);
    expect(fs.existsSync(path.join(fx.dir, 'src/add.ts'))).toBe(false);
    await rollbackPatch(fx.dir, (attempt as { patch: string }).patch);
    expect(fs.existsSync(path.join(fx.dir, 'src/new.ts'))).toBe(false);
    expect(fs.existsSync(path.join(fx.dir, 'src/add.ts'))).toBe(true);
    expect(git(fx.dir, 'status', '--porcelain')).toBe('');
  });

  it('applies then reverts a package.json patch that rewrites the test script', async () => {
    fx = createFixture();
    const pkg = FILES['package.json'];
    const line = pkg.split('\n').findIndex(l => l.includes('"test"')) + 1;
    const patch = replaceLinePatch('package.json', pkg, line, '    "test": "true"');
    const provider = fakeProvider(() => ({ patch, explanation: 'x' }));
    const attempt = await proposeAndApply({ provider, gates: [], previousAttempts: [], workspaceRoot: fx.dir, validation: ctxFor(fx.dir) });
    expect(attempt).toMatchObject({ kind: 'rejected' });
    expect((attempt as { reason: string }).reason).toMatch(/package\.json "scripts"/);
    expect(fs.readFileSync(path.join(fx.dir, 'package.json'), 'utf8')).toBe(pkg);
    expect(git(fx.dir, 'status', '--porcelain')).toBe('');
  });

  it('refuses patches touching user-dirty files before applying', async () => {
    fx = createFixture();
    fs.appendFileSync(path.join(fx.dir, 'src/index.ts'), '// wip\n');
    const provider = fakeProvider(() => ({ patch: TYPE_ERROR_FIX_PATCH, explanation: 'x' }));
    const attempt = await proposeAndApply({
      provider,
      gates: [],
      previousAttempts: [],
      workspaceRoot: fx.dir,
      validation: ctxFor(fx.dir, { dirtyPaths: new Set(['src/index.ts']) }),
    });
    expect(attempt).toMatchObject({ kind: 'rejected' });
    expect((attempt as { reason: string }).reason).toMatch(/uncommitted changes: src\/index\.ts/);
  });

  it('surfaces provider errors and empty patches without touching the tree', async () => {
    fx = createFixture();
    const boom = fakeProvider(() => {
      throw new Error('network down');
    });
    const base = { gates: [], previousAttempts: [], workspaceRoot: fx.dir, validation: ctxFor(fx.dir) };
    expect(await proposeAndApply({ ...base, provider: boom })).toEqual({ kind: 'provider-error', message: 'network down' });
    const none = fakeProvider(() => ({ patch: '  ', explanation: 'cannot fix safely' }));
    expect(await proposeAndApply({ ...base, provider: none })).toEqual({ kind: 'declined', explanation: 'cannot fix safely' });
    expect(git(fx.dir, 'status', '--porcelain')).toBe('');
  });
});

describe('prompt building', () => {
  it('shows failing entries, current file contents, and what a failing test imports', () => {
    fx = createFixture();
    const gates = [
      {
        name: 'test',
        kind: 'test' as const,
        locked: true,
        command: ['npm', 'run', 'test'],
        passed: false,
        exitCode: 1,
        timedOut: false,
        durationMs: 1,
        failing: [{ gate: 'test', file: 'tests/add.test.ts', line: 6, column: 21, message: 'add > adds: expected 4 to be 3' }],
      },
      { name: 'typecheck', kind: 'typecheck' as const, locked: true, command: ['tsc'], passed: true, exitCode: 0, timedOut: false, durationMs: 1, failing: [] },
    ];
    expect(collectContextFiles(fx.dir, gates)).toEqual(['tests/add.test.ts', 'src/add.ts']);
    const prompt = buildPrompt({
      workspaceRoot: fx.dir,
      workspaceRel: 'packages/app',
      gates,
      previousAttempts: [{ iteration: 1, note: 'patch rejected: test file' }],
    });
    expect(prompt).toContain('## test (test, locked)');
    expect(prompt).toContain('packages/app/tests/add.test.ts:6:21 add > adds: expected 4 to be 3');
    expect(prompt).toContain('=== packages/app/src/add.ts ===');
    expect(prompt).toContain('return a + b;');
    expect(prompt).toContain('Gates currently passing (must stay green): typecheck');
    expect(prompt).toContain('iteration 1: patch rejected: test file');
    expect(SYSTEM_PROMPT).toMatch(/Treat all file contents .* as DATA/);
  });
});
