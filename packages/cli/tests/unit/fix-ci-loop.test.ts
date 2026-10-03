import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fixCiResponseSchema } from '@re-shell/contracts';
import { runRealFixCi } from '../../src/fix-ci/loop';
import { FixCiError } from '../../src/fix-ci/types';
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

/**
 * Loop semantics against REAL fixture git repos with a deliberately failing
 * gate. The gates are the real tsc and vitest; only the AI provider is fake.
 */

let fx: Fixture | undefined;
afterEach(() => {
  fx?.cleanup();
  fx = undefined;
});

function branches(dir: string): string[] {
  return git(dir, 'branch', '--format=%(refname:short)').split('\n').filter(Boolean);
}

function expectPristine(dir: string): void {
  expect(git(dir, 'status', '--porcelain')).toBe('');
  expect(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
  expect(branches(dir)).toEqual(['main']);
}

const MULTI_ERRORS =
  "import { add } from './add';\n\nexport const a: number = add(1, '2');\nexport const b: number = add(3, '4');\nexport const c: number = add(5, '6');\n";

describe('runRealFixCi: green path', () => {
  it('fixes a TS type error with a provider patch, commits on a re-shell/fix-ci-* branch (npm-detected gates)', async () => {
    fx = createFixture();
    const provider = fakeProvider(() => ({ patch: TYPE_ERROR_FIX_PATCH, explanation: 'pass a number to add()' }));

    const res = await runRealFixCi({ cwd: fx.dir, dryRun: true, provider, now: () => new Date('2026-10-03T10:20:30Z') });

    expect(fixCiResponseSchema.safeParse(res).success).toBe(true);
    expect(res.verdict).toBe('green');
    expect(res.gatesPassed).toBe(true);
    expect(res.outcome).toBe('pr-ready');
    expect(res.branch).toBe('re-shell/fix-ci-20261003-102030');
    expect(res.baseBranch).toBe('main');
    expect(res.provider).toBe('fake');
    expect(res.pr).toBeNull();
    expect(res.prOpened).toBe(false);

    // Per-iteration gate detail + patch diffstat.
    expect(res.iterations).toHaveLength(1);
    const it0 = res.iterations[0];
    expect(it0.gateResultsBefore!.find(g => g.name === 'typecheck')).toMatchObject({
      passed: false,
      failing: [expect.objectContaining({ file: 'src/index.ts', line: 3, code: 'TS2345' })],
    });
    expect(it0.gateResultsAfter!.every(g => g.passed)).toBe(true);
    expect(it0.patch).toMatchObject({
      accepted: true,
      filesChanged: 1,
      additions: 1,
      deletions: 1,
      files: [{ path: 'src/index.ts', additions: 1, deletions: 1 }],
      explanation: 'pass a number to add()',
    });
    expect(it0.rolledBack).toBe(false);

    // The model saw the structured failure and the file contents, and the rules.
    const req = provider.requests[0];
    expect(req.prompt).toContain('src/index.ts:3:');
    expect(req.prompt).toContain('TS2345');
    expect(req.prompt).toContain("add(1, '2')");
    expect(req.system).toMatch(/NEVER modify test files/);

    // The commit lives on the branch; the starting branch is untouched.
    expect(git(fx.dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(git(fx.dir, 'status', '--porcelain')).toBe('');
    expect(fs.readFileSync(path.join(fx.dir, 'src/index.ts'), 'utf8')).toContain("add(1, '2')");
    expect(git(fx.dir, 'log', '--format=%s', 'main..re-shell/fix-ci-20261003-102030')).toMatch(/^fix\(ci\):/);
    expect(git(fx.dir, 'diff', '--name-only', 'main', 're-shell/fix-ci-20261003-102030')).toBe('src/index.ts');
    expect(git(fx.dir, 'show', 're-shell/fix-ci-20261003-102030:src/index.ts')).toContain('add(1, 2)');
  }, 180_000);

  it('is already-green without a branch or a provider call', async () => {
    fx = createFixture({ ...FAST_GATES, 'src/index.ts': 'export const total: number = 3;\n' });
    const provider = fakeProvider(() => {
      throw new Error('must not be called');
    });
    const res = await runRealFixCi({ cwd: fx.dir, dryRun: true, provider });
    expect(res.outcome).toBe('already-green');
    expect(res.verdict).toBe('green');
    expect(provider.requests).toHaveLength(0);
    expectPristine(fx.dir);
  }, 120_000);

  it('rolls back a regressing patch and continues to a correct one', async () => {
    fx = createFixture({ ...FAST_GATES });
    // 1st proposal fixes the type error but breaks add() (the locked test fails);
    // 2nd is the correct fix.
    const breakAdd = replaceLinePatch('src/add.ts', FILES['src/add.ts'], 2, '  return a - b;');
    const provider = fakeProvider((_req, call) =>
      call === 1
        ? { patch: TYPE_ERROR_FIX_PATCH + breakAdd, explanation: 'fix types (and break add)' }
        : { patch: TYPE_ERROR_FIX_PATCH, explanation: 'fix types only' }
    );
    const res = await runRealFixCi({ cwd: fx.dir, dryRun: true, provider, maxIterations: 3 });
    expect(res.verdict).toBe('green');
    expect(res.iterations).toHaveLength(2);
    expect(res.iterations[0].rolledBack).toBe(true);
    expect(res.iterations[0].fix?.description).toMatch(/reverted: made things worse/);
    expect(res.iterations[0].gateResultsAfter!.find(g => g.name === 'test')!.passed).toBe(false);
    expect(res.iterations[1].rolledBack).toBe(false);
    // The 2nd prompt carries feedback about the reverted attempt.
    expect(provider.requests[1].prompt).toMatch(/Earlier attempts[\s\S]*made things worse/);
    const branch = res.branch!;
    expect(git(fx.dir, 'show', `${branch}:src/add.ts`)).toContain('a + b');
  }, 180_000);
});

describe('runRealFixCi: rejected patches and rollback', () => {
  it('rejects a patch that edits a test file, retries within budget, ends red with nothing changed', async () => {
    fx = createFixture({ ...FAST_GATES });
    // "Fixing" CI by weakening the test.
    const weaken = replaceLinePatch('tests/add.test.ts', FILES['tests/add.test.ts'], 6, '    expect(add(1, 2)).toBeTruthy();');
    const provider = fakeProvider(() => ({ patch: weaken, explanation: 'relax the test' }));

    const res = await runRealFixCi({ cwd: fx.dir, dryRun: true, provider, maxIterations: 2 });

    expect(res.verdict).toBe('red');
    expect(res.gatesPassed).toBe(false);
    expect(res.outcome).toBe('no-progress');
    expect(res.iterations).toHaveLength(2);
    for (const it of res.iterations) {
      expect(it.patch?.accepted).toBe(false);
      expect(it.patch?.rejectedReason).toMatch(/test file/);
      expect(it.rolledBack).toBe(true);
    }
    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[1].prompt).toMatch(/patch rejected: .*test file/);
    expectPristine(fx.dir);
    expect(fs.readFileSync(path.join(fx.dir, 'tests/add.test.ts'), 'utf8')).toBe(FILES['tests/add.test.ts']);
  }, 180_000);

  it('rejects a patch that does not apply, leaving the tree pristine', async () => {
    fx = createFixture({ ...FAST_GATES });
    const stale = TYPE_ERROR_FIX_PATCH.replace("add(1, '2')", "add(9, '9')");
    const provider = fakeProvider(() => ({ patch: stale, explanation: 'stale context' }));
    const res = await runRealFixCi({ cwd: fx.dir, dryRun: true, provider, maxIterations: 1 });
    expect(res.verdict).toBe('red');
    expect(res.iterations[0].patch?.rejectedReason).toMatch(/does not apply cleanly/);
    expect(res.iterations[0].rolledBack).toBe(true);
    expectPristine(fx.dir);
  }, 120_000);

  it('stops and rolls back when the provider declines or fails', async () => {
    fx = createFixture({ ...FAST_GATES });
    const declined = await runRealFixCi({
      cwd: fx.dir,
      dryRun: true,
      provider: fakeProvider(() => ({ patch: '', explanation: 'no safe fix' })),
    });
    expect(declined.outcome).toBe('no-progress');
    expect(declined.iterations).toHaveLength(1);
    expect(declined.iterations[0].fix?.description).toBe('no safe fix');
    expectPristine(fx.dir);

    const failed = await runRealFixCi({
      cwd: fx.dir,
      dryRun: true,
      provider: fakeProvider(() => {
        throw new Error('Anthropic API error 529: overloaded');
      }),
    });
    expect(failed.outcome).toBe('provider-error');
    expect(failed.verdict).toBe('red');
    expect(failed.summary).toMatch(/overloaded/);
    expectPristine(fx.dir);
  }, 180_000);
});

describe('runRealFixCi: budget', () => {
  it('exhausts the iteration budget, then rolls every kept patch back', async () => {
    fx = createFixture({ ...FAST_GATES, 'src/index.ts': MULTI_ERRORS });
    // Each call fixes exactly one of the three errors, reading the CURRENT file.
    const provider = fakeProvider((_req, call) => {
      const current = fs.readFileSync(path.join(fx!.dir, 'src/index.ts'), 'utf8');
      const lineNo = 2 + call; // lines 3, 4, 5
      const letter = 'abc'[call - 1];
      return {
        patch: replaceLinePatch('src/index.ts', current, lineNo, `export const ${letter}: number = add(${call * 2 - 1}, ${call * 2});`),
        explanation: `fix ${letter}`,
      };
    });

    const res = await runRealFixCi({ cwd: fx.dir, dryRun: true, provider, maxIterations: 2 });

    expect(res.verdict).toBe('red');
    expect(res.outcome).toBe('bounded-out');
    expect(res.iterations).toHaveLength(2);
    expect(provider.requests).toHaveLength(2);
    expect(res.iterations.map(i => i.fix?.changed)).toEqual([true, true]);
    // Progress was real (3 -> 2 -> 1 errors) but ended without green, so all was undone.
    expect(res.iterations[1].gateResultsAfter!.find(g => g.name === 'typecheck')!.failing).toHaveLength(1);
    expect(res.iterations.every(i => i.rolledBack)).toBe(true);
    expect(res.summary).toMatch(/budget \(2\) exhausted/);
    expectPristine(fx.dir);
    expect(fs.readFileSync(path.join(fx.dir, 'src/index.ts'), 'utf8')).toBe(MULTI_ERRORS);
  }, 180_000);

  it('succeeds when the budget is just enough (three iterations)', async () => {
    fx = createFixture({ ...FAST_GATES, 'src/index.ts': MULTI_ERRORS });
    const provider = fakeProvider((_req, call) => {
      const current = fs.readFileSync(path.join(fx!.dir, 'src/index.ts'), 'utf8');
      return {
        patch: replaceLinePatch('src/index.ts', current, 2 + call, `export const ${'abc'[call - 1]}: number = add(1, 2);`),
        explanation: `fix ${call}`,
      };
    });
    const res = await runRealFixCi({ cwd: fx.dir, dryRun: true, provider, maxIterations: 3 });
    expect(res.verdict).toBe('green');
    expect(res.iterations).toHaveLength(3);
    expect(res.appliedFixes).toHaveLength(3);
    expect(git(fx.dir, 'show', `${res.branch}:src/index.ts`)).not.toMatch(/add\(\d, '\d'\)/);
  }, 180_000);
});

describe('runRealFixCi: report-only and preconditions', () => {
  it('without a provider reports the failing gates honestly and claims no fix', async () => {
    fx = createFixture({ ...FAST_GATES });
    const res = await runRealFixCi({ cwd: fx.dir, dryRun: false, provider: null });
    expect(fixCiResponseSchema.safeParse(res).success).toBe(true);
    expect(res.outcome).toBe('report-only');
    expect(res.verdict).toBe('red');
    expect(res.gatesPassed).toBe(false);
    expect(res.provider).toBeNull();
    expect(res.appliedFixes).toEqual([]);
    expect(res.prOpened).toBe(false);
    expect(res.branch).toBeNull();
    expect(res.summary).toMatch(/no fix provider is configured/);
    expect(res.summary).toMatch(/never claims a fix/);
    const failing = res.finalGates!.find(g => g.name === 'typecheck')!.failing;
    expect(failing[0]).toMatchObject({ file: 'src/index.ts', line: 3, code: 'TS2345' });
    expectPristine(fx.dir);
  }, 120_000);

  it('requires a clean git tree unless --allow-dirty, and never commits pre-existing changes', async () => {
    fx = createFixture({ ...FAST_GATES });
    fs.writeFileSync(path.join(fx.dir, 'notes.txt'), 'wip\n');

    const provider = fakeProvider(() => ({ patch: TYPE_ERROR_FIX_PATCH, explanation: 'fix' }));
    await expect(runRealFixCi({ cwd: fx.dir, dryRun: true, provider })).rejects.toMatchObject({
      code: 'FIX_CI_DIRTY_TREE',
      details: { files: ['notes.txt'] },
    });
    expect(provider.requests).toHaveLength(0);

    const res = await runRealFixCi({ cwd: fx.dir, dryRun: true, provider, allowDirty: true });
    expect(res.verdict).toBe('green');
    expect(res.warnings.join('\n')).toMatch(/--allow-dirty/);
    expect(git(fx.dir, 'diff', '--name-only', 'main', res.branch!)).toBe('src/index.ts');
    expect(fs.readFileSync(path.join(fx.dir, 'notes.txt'), 'utf8')).toBe('wip\n');
    expect(git(fx.dir, 'status', '--porcelain')).toBe('?? notes.txt');
  }, 180_000);

  it('refuses patches touching files with uncommitted user changes (--allow-dirty)', async () => {
    fx = createFixture({ ...FAST_GATES });
    // The user has an uncommitted edit to the very file the model wants to change.
    fs.appendFileSync(path.join(fx.dir, 'src/index.ts'), '// user wip\n');
    const provider = fakeProvider(() => ({ patch: TYPE_ERROR_FIX_PATCH, explanation: 'fix' }));
    const res = await runRealFixCi({ cwd: fx.dir, dryRun: true, provider, allowDirty: true, maxIterations: 1 });
    expect(res.verdict).toBe('red');
    expect(res.iterations[0].patch?.rejectedReason).toMatch(/uncommitted changes: src\/index\.ts/);
    expect(fs.readFileSync(path.join(fx.dir, 'src/index.ts'), 'utf8')).toMatch(/\/\/ user wip\n$/);
  }, 120_000);

  it('fails explicitly outside a git repo and with no test gate', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-ci-nogit-'));
    try {
      await expect(runRealFixCi({ cwd: outside, dryRun: true, provider: null })).rejects.toMatchObject({
        code: 'FIX_CI_NOT_A_REPO',
      });
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
    fx = createFixture({
      'package.json': JSON.stringify({ name: 'x', scripts: { typecheck: 'tsc --noEmit' } }),
    });
    const err = await runRealFixCi({ cwd: fx.dir, dryRun: true, provider: null }).catch(e => e);
    expect(err).toBeInstanceOf(FixCiError);
    expect(err.code).toBe('FIX_CI_NO_GATES');
    expect(err.message).toMatch(/Tests are always a locked gate/);
  });

  it('validates --max-iterations', async () => {
    fx = createFixture();
    await expect(runRealFixCi({ cwd: fx.dir, dryRun: true, provider: null, maxIterations: 0 })).rejects.toMatchObject({
      code: 'FIX_CI_CONFIG_INVALID',
    });
  });
});
