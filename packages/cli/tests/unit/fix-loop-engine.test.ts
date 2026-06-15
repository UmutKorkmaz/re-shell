import { describe, it, expect } from 'vitest';
import {
  runFixLoop,
  gateResult,
  fixResult,
  DEFAULT_MAX_ITERATIONS,
  type GateResult,
  type FixResult,
} from '../../src/utils/fix-loop-engine';
import { fixCiResponseSchema } from '@re-shell/contracts';

/**
 * Pure-engine conformance for the `re-shell fix --ci` loop (issue #18). The
 * gate evaluator + fix applier are injected, so the loop is fully testable
 * offline with scripted state transitions.
 */

/** Scripted evaluator: returns the queued gate results in order (repeats last). */
function scriptedGates(results: GateResult[]) {
  let i = 0;
  return () => Promise.resolve(results[Math.min(i++, results.length - 1)]!);
}

/** Scripted applier: returns the queued fix results in order. */
function scriptedFixes(results: FixResult[]) {
  let i = 0;
  return () => Promise.resolve(results[Math.min(i++, results.length - 1)]!);
}

describe('runFixLoop', () => {
  it('returns already-green when gates pass at iteration 0', async () => {
    const run = await runFixLoop(
      () => Promise.resolve(gateResult(true, [])),
      () => Promise.resolve(fixResult('noop', 'noop', false))
    );
    expect(run.outcome).toBe('already-green');
    expect(run.gatesPassed).toBe(true);
    expect(run.appliedFixes).toEqual([]);
    expect(run.iterations).toHaveLength(1);
  });

  it('reaches pr-ready after a fix turns gates green', async () => {
    // Start red (lint fails), then go green after one fix.
    const run = await runFixLoop(
      scriptedGates([gateResult(false, ['lint']), gateResult(true, [])]),
      scriptedFixes([fixResult('lint-fix', 'ran eslint --fix', true)])
    );
    expect(run.outcome).toBe('pr-ready');
    expect(run.gatesPassed).toBe(true);
    expect(run.appliedFixes).toHaveLength(1);
    expect(run.appliedFixes[0]!.fixId).toBe('lint-fix');
    expect(run.iterations).toHaveLength(1);
    expect(run.iterations[0]!.gatesBefore.passed).toBe(false);
    expect(run.iterations[0]!.gatesAfter?.passed).toBe(true);
  });

  it('hits the rollback boundary when a fix makes no progress (changed: false)', async () => {
    const run = await runFixLoop(
      () => Promise.resolve(gateResult(false, ['unit-tests'])),
      () => Promise.resolve(fixResult('noop', 'nothing to fix', false))
    );
    expect(run.outcome).toBe('no-progress');
    expect(run.gatesPassed).toBe(false);
    expect(run.appliedFixes).toHaveLength(1);
    expect(run.summary).toMatch(/no progress/);
  });

  it('hits bounded-out when the iteration budget is exhausted with gates still red', async () => {
    // Gates never go green; fixes keep "changing" but never help.
    const run = await runFixLoop(
      () => Promise.resolve(gateResult(false, ['unit-tests'])),
      () => Promise.resolve(fixResult('flail', 'tried something', true)),
      3
    );
    expect(run.outcome).toBe('bounded-out');
    expect(run.gatesPassed).toBe(false);
    expect(run.appliedFixes.length).toBe(3);
    expect(run.summary).toMatch(/budget exhausted/);
  });

  it('caps total work at DEFAULT_MAX_ITERATIONS by default', async () => {
    const run = await runFixLoop(
      () => Promise.resolve(gateResult(false, ['x'])),
      () => Promise.resolve(fixResult('flail', 'tried', true))
    );
    expect(run.outcome).toBe('bounded-out');
    expect(run.appliedFixes.length).toBe(DEFAULT_MAX_ITERATIONS);
  });

  it('never merges or pushes (pr-ready is only a signal; no side effects)', async () => {
    // The pure engine has no I/O; pr-ready carries no push/merge action.
    const run = await runFixLoop(
      scriptedGates([gateResult(false, ['lint']), gateResult(true, [])]),
      scriptedFixes([fixResult('lint-fix', 'fixed', true)])
    );
    expect(run.outcome).toBe('pr-ready');
    expect(run.summary).toMatch(/human-controlled/);
  });

  it('logs each iteration with before/after gate state', async () => {
    const run = await runFixLoop(
      scriptedGates([
        gateResult(false, ['lint']),
        gateResult(false, ['unit-tests']),
        gateResult(true, []),
      ]),
      scriptedFixes([
        fixResult('lint-fix', 'fixed lint', true),
        fixResult('test-fix', 'fixed tests', true),
      ])
    );
    expect(run.outcome).toBe('pr-ready');
    expect(run.iterations).toHaveLength(2);
    expect(run.iterations[0]!.fix!.fixId).toBe('lint-fix');
    expect(run.iterations[1]!.fix!.fixId).toBe('test-fix');
    // Each iteration recorded a before + after gate evaluation.
    expect(run.iterations.every(it => it.gatesAfter !== undefined)).toBe(true);
  });
});

describe('contracts conformance', () => {
  it('a constructed fix-ci response validates against fixCiResponseSchema', async () => {
    const run = await runFixLoop(
      scriptedGates([gateResult(false, ['lint']), gateResult(true, [])]),
      scriptedFixes([fixResult('lint-fix', 'fixed', true)])
    );
    const payload = {
      outcome: run.outcome,
      gatesPassed: run.gatesPassed,
      iterations: run.iterations.map(it => ({
        iteration: it.iteration,
        gatesBefore: { passed: it.gatesBefore.passed, failingGates: [...it.gatesBefore.failingGates] },
        ...(it.fix ? { fix: { fixId: it.fix.fixId, description: it.fix.description, changed: it.fix.changed } } : {}),
        ...(it.gatesAfter ? { gatesAfter: { passed: it.gatesAfter.passed, failingGates: [...it.gatesAfter.failingGates] } } : {}),
      })),
      appliedFixes: run.appliedFixes.map(f => ({ fixId: f.fixId, description: f.description, changed: f.changed })),
      summary: run.summary,
      prOpened: false,
      prUrl: '',
      warnings: [],
    };
    expect(fixCiResponseSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects an unknown outcome against the schema', () => {
    const payload = {
      outcome: 'mystery',
      gatesPassed: true,
      iterations: [],
      appliedFixes: [],
      summary: 'x',
      prOpened: false,
      prUrl: '',
      warnings: [],
    };
    expect(fixCiResponseSchema.safeParse(payload).success).toBe(false);
  });
});
