import { describe, it, expect } from 'vitest';
import {
  errorCodeSchema,
  fixCiFailingEntrySchema,
  fixCiGateResultSchema,
  fixCiPatchSchema,
  fixCiResponseSchema,
  jsonResponseSchema,
} from './index.js';

const gate = {
  name: 'typecheck',
  kind: 'typecheck' as const,
  locked: true,
  command: ['npm', 'run', 'typecheck'],
  passed: false,
  exitCode: 2,
  timedOut: false,
  durationMs: 1234,
  failing: [{ gate: 'typecheck', file: 'src/a.ts', line: 3, column: 7, code: 'TS2345', message: 'bad arg' }],
};

describe('fix --ci contracts (R-3)', () => {
  it('accepts the new error codes', () => {
    for (const code of [
      'FIX_CI_NOT_A_REPO',
      'FIX_CI_DIRTY_TREE',
      'FIX_CI_CONFIG_INVALID',
      'FIX_CI_NO_GATES',
      'FIX_CI_NO_PROVIDER',
      'FIX_CI_GATES_RED',
    ]) {
      expect(errorCodeSchema.safeParse(code).success, code).toBe(true);
    }
  });

  it('validates failing entries, gate results and patches', () => {
    expect(fixCiFailingEntrySchema.safeParse(gate.failing[0]).success).toBe(true);
    expect(fixCiFailingEntrySchema.safeParse({ gate: 'x' }).success).toBe(false);
    expect(fixCiGateResultSchema.safeParse(gate).success).toBe(true);
    expect(fixCiGateResultSchema.safeParse({ ...gate, kind: 'nope' }).success).toBe(false);
    expect(fixCiGateResultSchema.safeParse({ ...gate, exitCode: null, timedOut: true }).success).toBe(true);
    expect(
      fixCiPatchSchema.safeParse({
        accepted: true,
        files: [{ path: 'src/a.ts', additions: 1, deletions: 1 }],
        filesChanged: 1,
        additions: 1,
        deletions: 1,
      }).success
    ).toBe(true);
  });

  it('keeps legacy payloads valid and accepts the full R-3 run log', () => {
    const legacy = {
      outcome: 'pr-ready',
      gatesPassed: true,
      iterations: [{ iteration: 1, gatesBefore: { passed: false, failingGates: ['lint'] } }],
      appliedFixes: [],
      summary: 's',
      prOpened: false,
      prUrl: '',
      warnings: [],
    };
    expect(fixCiResponseSchema.safeParse(legacy).success).toBe(true);

    const full = {
      ...legacy,
      outcome: 'bounded-out',
      gatesPassed: false,
      verdict: 'red',
      provider: 'anthropic',
      branch: 're-shell/fix-ci-20261003-101530',
      baseBranch: 'main',
      pr: null,
      manualSteps: ['git push -u origin x'],
      gates: {
        source: '.re-shell/fix-ci.yaml',
        definitions: [{ name: 'typecheck', kind: 'typecheck', locked: true, command: ['tsc'] }],
      },
      iterations: [
        {
          iteration: 1,
          gatesBefore: { passed: false, failingGates: ['typecheck'] },
          gateResultsBefore: [gate],
          patch: { accepted: false, files: [], filesChanged: 0, additions: 0, deletions: 0, rejectedReason: 'test file' },
          rolledBack: true,
        },
      ],
      finalGates: [gate],
    };
    expect(fixCiResponseSchema.safeParse(full).success).toBe(true);
    expect(fixCiResponseSchema.safeParse({ ...full, verdict: 'maybe' }).success).toBe(false);
    expect(fixCiResponseSchema.safeParse({ ...full, outcome: 'report-only' }).success).toBe(true);
    expect(fixCiResponseSchema.safeParse({ ...full, outcome: 'provider-error' }).success).toBe(true);
  });

  it('a red run travels as an error envelope whose details are the run log', () => {
    const env = {
      ok: false,
      error: { code: 'FIX_CI_NO_PROVIDER', message: 'report-only', details: { outcome: 'report-only' } },
      warnings: [],
    };
    expect(jsonResponseSchema(fixCiResponseSchema).safeParse(env).success).toBe(true);
  });
});
