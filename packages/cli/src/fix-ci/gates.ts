// Real gate evaluator for `fix --ci` (R-3).
//
// Each gate runs as a real child process (argv, no shell) with a timeout. A
// gate passes only when it exits 0 within its timeout; spawn failures and
// timeouts are failures, never silently skipped. Failures are parsed into
// structured `failing` entries.

import type { FixCiGateResult } from '@re-shell/contracts';
import { runProcess } from './exec';
import { parseGateFailures, stripAnsi, tailEntry } from './parsers';
import type { FixCiFailingEntry, GateDefinition } from './types';

/** Env applied to every gate: deterministic, non-interactive, no colour. */
const GATE_ENV: NodeJS.ProcessEnv = {
  CI: '1',
  NO_COLOR: '1',
  FORCE_COLOR: '0',
  NODE_DISABLE_COLORS: '1',
};

/** Run one gate and return its structured result. Never throws. */
export async function runGate(gate: GateDefinition, root: string): Promise<FixCiGateResult> {
  const result = await runProcess(gate.command, {
    cwd: root,
    timeoutMs: gate.timeoutMs,
    env: GATE_ENV,
  });
  const ctx = { gate: gate.name, kind: gate.kind, root };
  const passed = result.exitCode === 0 && !result.timedOut && !result.spawnError;
  let failing: FixCiFailingEntry[] = [];
  if (!passed) {
    if (result.spawnError) {
      failing = [
        { gate: gate.name, message: `could not run \`${gate.command.join(' ')}\`: ${result.spawnError}` },
      ];
    } else if (result.timedOut) {
      failing = [
        {
          gate: gate.name,
          message: `timed out after ${gate.timeoutMs}ms running \`${gate.command.join(' ')}\``,
        },
      ];
    } else {
      const combined = `${stripAnsi(result.stdout)}\n${stripAnsi(result.stderr)}`;
      failing = parseGateFailures(combined, ctx, gate.parser);
      if (failing.length === 0) failing = [tailEntry(combined, ctx)];
    }
  }
  return {
    name: gate.name,
    kind: gate.kind,
    locked: gate.locked,
    command: [...gate.command],
    passed,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
    failing,
  };
}

/**
 * Evaluate every gate in order. All gates run (no short-circuit) so the
 * failing entries cover everything that is red at this point.
 */
export async function evaluateGates(
  gates: readonly GateDefinition[],
  root: string
): Promise<FixCiGateResult[]> {
  const results: FixCiGateResult[] = [];
  for (const gate of gates) {
    results.push(await runGate(gate, root));
  }
  return results;
}

/** True only when every evaluated gate passed. */
export function allPassed(results: readonly FixCiGateResult[]): boolean {
  return results.length > 0 && results.every(r => r.passed);
}

/** Names of the failing gates. */
export function failingGateNames(results: readonly FixCiGateResult[]): string[] {
  return results.filter(r => !r.passed).map(r => r.name);
}

/** Total failing entries across all gates (a failed gate counts at least 1). */
export function failureCount(results: readonly FixCiGateResult[]): number {
  return results.reduce((n, r) => n + (r.passed ? 0 : Math.max(1, r.failing.length)), 0);
}

/**
 * True when `after` is strictly worse than `before`: a gate that was passing
 * now fails, or the total failure count increased.
 */
export function isRegression(
  before: readonly FixCiGateResult[],
  after: readonly FixCiGateResult[]
): boolean {
  const passedBefore = new Set(before.filter(r => r.passed).map(r => r.name));
  if (after.some(r => !r.passed && passedBefore.has(r.name))) return true;
  return failureCount(after) > failureCount(before);
}
