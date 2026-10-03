import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runFixCi } from '../../src/commands/fix-ci';
import { fixCiResponseSchema } from '@re-shell/contracts';
import { gateResult, fixResult } from '../../src/utils/fix-loop-engine';
import { FAST_GATES, TYPE_ERROR_FIX_PATCH, createFixture, fakeProvider, type Fixture } from '../utils/fix-ci-fixture';

/**
 * Integration coverage for `re-shell fix --ci` (issue #18): the loop wired to
 * the command, with injectable evaluators + an injectable PR opener so the
 * safety contract (dry-run default, PR only on --no-dry-run + pr-ready, never
 * auto-merge) is verifiable offline.
 */

describe('runFixCi', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let written: string[];
  let fixture: Fixture | undefined;

  beforeEach(() => {
    written = [];
    process.exitCode = undefined;
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        written.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      }) as unknown as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    fixture?.cleanup();
    fixture = undefined;
    writeSpy.mockRestore();
    process.exitCode = undefined;
  });

  function lastJson(): Record<string, unknown> {
    const raw = written[written.length - 1];
    expect(raw, 'expected JSON output on stdout').toBeDefined();
    return JSON.parse(raw as string);
  }

  describe('without an injected evaluator (the REAL evaluator path)', () => {
    let scratch: string;
    beforeEach(() => {
      scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-ci-cmd-'));
    });
    afterEach(() => {
      fs.rmSync(scratch, { recursive: true, force: true });
    });

    it('fails explicitly (never claims green) when the workspace is not a git repo', async () => {
      const applyFix = vi.fn();
      const openPullRequest = vi.fn();
      await runFixCi({ json: true, noDryRun: true, applyFix, openPullRequest, cwd: scratch, provider: null });

      const env = lastJson();
      expect(env.ok).toBe(false);
      expect(env.error).toMatchObject({ code: 'FIX_CI_NOT_A_REPO', message: expect.stringMatching(/not inside a git work tree/i) });
      expect(env.data).toBeUndefined();
      expect(applyFix).not.toHaveBeenCalled();
      expect(openPullRequest).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it('reports the failure on stderr in human mode', async () => {
      const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      try {
        await runFixCi({ cwd: scratch, provider: null });
        expect(stderr).toHaveBeenCalledWith(expect.stringMatching(/not inside a git work tree/i));
        expect(written).toEqual([]);
        expect(process.exitCode).toBe(1);
      } finally {
        stderr.mockRestore();
      }
    });

    it('is report-only without a provider: ok:false FIX_CI_NO_PROVIDER, full run log in details, exit 1', async () => {
      fixture = createFixture(FAST_GATES);
      await runFixCi({ json: true, noDryRun: true, cwd: fixture.dir, provider: null });
      const env = lastJson() as { ok: boolean; error: { code: string; message: string; details: Record<string, unknown> } };
      expect(env.ok).toBe(false);
      expect(env.error.code).toBe('FIX_CI_NO_PROVIDER');
      const parsed = fixCiResponseSchema.safeParse(env.error.details);
      expect(parsed.success).toBe(true);
      expect(env.error.details).toMatchObject({ outcome: 'report-only', verdict: 'red', gatesPassed: false, branch: null });
      expect(process.exitCode).toBe(1);
    }, 120_000);

    it('renders the failing gates in human report-only mode and exits non-zero', async () => {
      fixture = createFixture(FAST_GATES);
      await runFixCi({ cwd: fixture.dir, provider: null });
      const out = written.join('');
      expect(out).toMatch(/report-only/);
      expect(out).toMatch(/typecheck/);
      expect(out).toMatch(/src\/index\.ts:3/);
      expect(process.exitCode).toBe(1);
    }, 120_000);

    it('green run: ok:true envelope validates against the contract and exits 0', async () => {
      fixture = createFixture(FAST_GATES);
      const provider = fakeProvider(() => ({ patch: TYPE_ERROR_FIX_PATCH, explanation: 'pass a number' }));
      await runFixCi({ json: true, cwd: fixture.dir, provider });
      const env = lastJson() as { ok: boolean; data: Record<string, unknown> };
      expect(env.ok).toBe(true);
      expect(fixCiResponseSchema.safeParse(env.data).success).toBe(true);
      expect(env.data).toMatchObject({ outcome: 'pr-ready', verdict: 'green', gatesPassed: true, pr: null, prOpened: false });
      expect(process.exitCode).toBeUndefined();
    }, 120_000);

    it('surfaces config errors (a locked gate cannot be skipped) as FIX_CI_CONFIG_INVALID', async () => {
      fixture = createFixture(FAST_GATES);
      await runFixCi({ json: true, cwd: fixture.dir, provider: null, skipGates: ['test'] });
      expect(lastJson().error).toMatchObject({ code: 'FIX_CI_CONFIG_INVALID', message: expect.stringMatching(/locked and cannot be skipped/) });
      expect(process.exitCode).toBe(1);
    });

    it('refuses a dirty tree with FIX_CI_DIRTY_TREE', async () => {
      fixture = createFixture(FAST_GATES);
      fs.writeFileSync(path.join(fixture.dir, 'wip.txt'), 'x');
      await runFixCi({ json: true, cwd: fixture.dir, provider: null });
      expect(lastJson().error).toMatchObject({ code: 'FIX_CI_DIRTY_TREE', details: { files: ['wip.txt'] } });
      expect(process.exitCode).toBe(1);
    });
  });

  it('opens NO PR in dry-run even when gates go green', async () => {
    let evals = 0;
    const evaluate = () => {
      evals++;
      return Promise.resolve(gateResult(evals > 1, evals > 1 ? [] : ['lint']));
    };
    const applyFix = () => Promise.resolve(fixResult('lint-fix', 'fixed', true));

    await runFixCi({ json: true, evaluate, applyFix }); // dryRun defaults to true

    const env = lastJson();
    expect(env['ok']).toBe(true);
    const data = env['data'] as { outcome: string; gatesPassed: boolean; prOpened: boolean };
    expect(data.outcome).toBe('pr-ready');
    expect(data.gatesPassed).toBe(true);
    expect(data.prOpened).toBe(false);
    expect(process.exitCode).toBeUndefined();
  });

  it('opens a PR under --no-dry-run when gates reach pr-ready', async () => {
    let evals = 0;
    const evaluate = () => {
      evals++;
      return Promise.resolve(gateResult(evals > 1, evals > 1 ? [] : ['lint']));
    };
    const applyFix = () => Promise.resolve(fixResult('lint-fix', 'fixed', true));
    let opened = false;
    const openPullRequest = async () => {
      opened = true;
      return 'https://example.com/pr/1';
    };

    await runFixCi({ json: true, noDryRun: true, evaluate, applyFix, openPullRequest });

    const data = lastJson().data as { outcome: string; prOpened: boolean; prUrl: string };
    expect(data.outcome).toBe('pr-ready');
    expect(opened).toBe(true);
    expect(data.prOpened).toBe(true);
    expect(data.prUrl).toBe('https://example.com/pr/1');
  });

  it('does NOT open a PR when gates fail (no-progress)', async () => {
    const evaluate = () => Promise.resolve(gateResult(false, ['unit-tests']));
    const applyFix = () => Promise.resolve(fixResult('noop', 'nothing', false));
    let opened = false;
    const openPullRequest = async () => {
      opened = true;
      return 'url';
    };

    await runFixCi({ json: true, noDryRun: true, evaluate, applyFix, openPullRequest });

    const data = lastJson().data as { outcome: string; prOpened: boolean };
    expect(data.outcome).toBe('no-progress');
    expect(opened).toBe(false);
    expect(data.prOpened).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('emits output that validates against fixCiResponseSchema', async () => {
    const evaluate = () => Promise.resolve(gateResult(true, []));
    await runFixCi({ json: true, evaluate, applyFix: () => Promise.resolve(fixResult('x', 'x', false)) });
    expect(fixCiResponseSchema.safeParse(lastJson().data).success).toBe(true);
  });

  it('reports already-green when gates pass at iteration 0', async () => {
    const evaluate = () => Promise.resolve(gateResult(true, []));
    await runFixCi({ json: true, evaluate, applyFix: () => Promise.resolve(fixResult('x', 'x', false)) });
    const data = lastJson().data as { outcome: string };
    expect(data.outcome).toBe('already-green');
  });
});
