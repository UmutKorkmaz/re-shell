import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { runFixCi } from '../../src/commands/fix-ci';
import { fixCiResponseSchema } from '@re-shell/contracts';
import { gateResult, fixResult } from '../../src/utils/fix-loop-engine';

/**
 * Integration coverage for `re-shell fix --ci` (issue #18): the loop wired to
 * the command, with injectable evaluators + an injectable PR opener so the
 * safety contract (dry-run default, PR only on --no-dry-run + pr-ready, never
 * auto-merge) is verifiable offline.
 */

describe('runFixCi', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let written: string[];

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
    writeSpy.mockRestore();
    process.exitCode = undefined;
  });

  function lastJson(): Record<string, unknown> {
    const raw = written[written.length - 1];
    expect(raw, 'expected JSON output on stdout').toBeDefined();
    return JSON.parse(raw as string);
  }

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
