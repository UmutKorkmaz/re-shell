// `re-shell fix --ci` — PURE autonomous fix-loop engine.
//
// A bounded, gate-locked state machine that drives remediation to green:
// each iteration evaluates a set of LOCKED gates (tests/health must pass), and
// if any fail, applies one fix from an injectable applier, then re-evaluates.
// The loop stops when all gates pass (PR-ready), when an iteration makes no
// progress (rollback boundary), or when the iteration budget is exhausted.
// It NEVER decides to merge or push to a protected branch — that stays
// human-controlled. This module is intentionally I/O-free: the gate evaluator
// and fix applier are INJECTED, so the loop is fully testable offline. Any LLM
// planner sits behind an off-by-default hook in the command layer, not here.
//
// No mutation of any input is ever performed.

/** The result of evaluating the locked gates for one iteration. */
export interface GateResult {
  /** True only when EVERY gate passed. */
  readonly passed: boolean;
  /** Human id per failing gate (e.g. "unit-tests", "lint", "doctor"). */
  readonly failingGates: readonly string[];
}

/** The outcome of applying one remediation step. */
export interface FixResult {
  /** Stable id of the fix that was attempted (e.g. "doctor-fix", "lint-fix"). */
  readonly fixId: string;
  /** Human description of what the fix did (or tried to do). */
  readonly description: string;
  /** True when the fix actually changed something; false when it was a no-op. */
  readonly changed: boolean;
}

/** One iteration in the durable fix-loop log. */
export interface FixLoopIteration {
  /** 1-based iteration number. */
  readonly iteration: number;
  /** The gates as evaluated at the START of this iteration. */
  readonly gatesBefore: GateResult;
  /** The fix applied this iteration (absent on the final passing iteration). */
  readonly fix?: FixResult;
  /** The gates as evaluated AFTER the fix (absent if no fix was applied). */
  readonly gatesAfter?: GateResult;
}

/** Why the loop terminated. */
export type FixLoopOutcome =
  | 'pr-ready' // all gates passed → safe to open a PR (human-controlled merge)
  | 'no-progress' // an iteration applied a fix that changed nothing → rollback boundary
  | 'bounded-out' // the iteration budget was exhausted with gates still red
  | 'already-green'; // gates were green at iteration 0 → nothing to fix

/** The durable output of a fix-loop run. */
export interface FixLoopRun {
  readonly outcome: FixLoopOutcome;
  readonly iterations: readonly FixLoopIteration[];
  /** True when the final gate evaluation passed. */
  readonly gatesPassed: boolean;
  /** Human-readable summary. */
  readonly summary: string;
  /** The fixes applied across the run (in order). */
  readonly appliedFixes: readonly FixResult[];
}

/** The default iteration budget (a hard backstop so the loop never runs away). */
export const DEFAULT_MAX_ITERATIONS = 5;

/**
 * The injected gate evaluator: returns the current gate state. Must be pure-ish
 * from the engine's perspective (the engine calls it, never inspects how).
 */
export type GateEvaluator = () => Promise<GateResult> | GateResult;

/** The injected fix applier: given the failing gates, applies one remediation. */
export type FixApplier = (failing: GateResult) => Promise<FixResult> | FixResult;

/**
 * Run the bounded, gate-locked fix loop.
 *
 *   - Iteration 0 evaluates the gates; if already green, outcome is `already-green`.
 *   - Each subsequent iteration: eval gates → if pass, `pr-ready`; else apply a
 *     fix → eval again. A fix that reports `changed: false` triggers the
 *     rollback boundary (`no-progress`) — the loop stops rather than spin.
 *   - The iteration budget caps total work (`bounded-out`).
 *
 * The loop NEVER merges or pushes to a protected branch — `pr-ready` is only a
 * signal that a PR MAY be opened (the command layer + a human do that).
 */
export async function runFixLoop(
  evaluate: GateEvaluator,
  applyFix: FixApplier,
  maxIterations = DEFAULT_MAX_ITERATIONS
): Promise<FixLoopRun> {
  const iterations: FixLoopIteration[] = [];
  const appliedFixes: FixResult[] = [];

  // Iteration 0: baseline evaluation.
  const baseline = await evaluate();
  if (baseline.passed) {
    return {
      outcome: 'already-green',
      iterations: [{ iteration: 1, gatesBefore: baseline }],
      gatesPassed: true,
      summary: 'All gates already green; nothing to fix.',
      appliedFixes: [],
    };
  }

  let current = baseline;
  for (let i = 1; i <= maxIterations; i++) {
    // Apply one remediation for the current failing gates.
    const fix = await applyFix(current);
    appliedFixes.push(fix);

    if (!fix.changed) {
      // Rollback boundary: the applier had nothing to do → stop, don't spin.
      iterations.push({ iteration: i, gatesBefore: current, fix });
      return finish('no-progress', false, iterations, appliedFixes);
    }

    // Re-evaluate after the fix.
    const after = await evaluate();
    iterations.push({ iteration: i, gatesBefore: current, fix, gatesAfter: after });

    if (after.passed) {
      // Gates turned green after THIS fix → safe to open a PR.
      return finish('pr-ready', true, iterations, appliedFixes);
    }
    current = after;
  }

  // Budget exhausted with gates still red.
  return finish('bounded-out', current.passed, iterations, appliedFixes);
}

/** Build the final run with a summary tailored to the outcome. */
function finish(
  outcome: FixLoopOutcome,
  gatesPassed: boolean,
  iterations: readonly FixLoopIteration[],
  appliedFixes: readonly FixResult[]
): FixLoopRun {
  const fixCount = appliedFixes.length;
  const summary =
    outcome === 'pr-ready'
      ? `All gates passed after ${fixCount} fix(es); safe to open a PR (merge stays human-controlled).`
      : outcome === 'no-progress'
        ? `Stopped at iteration ${iterations.length}: a fix made no progress (rollback boundary). ${fixCount} fix(es) applied; gates still red.`
        : `Iteration budget exhausted after ${iterations.length} iteration(s); gates still red. ${fixCount} fix(es) applied.`;
  return { outcome, iterations, gatesPassed, summary, appliedFixes };
}

/**
 * A pure gate result builder (convenience for tests + the command layer's
 * adapter from real gate runners).
 */
export function gateResult(
  passed: boolean,
  failingGates: readonly string[] = []
): GateResult {
  return { passed, failingGates };
}

/**
 * A pure fix-result builder (convenience).
 */
export function fixResult(
  fixId: string,
  description: string,
  changed: boolean
): FixResult {
  return { fixId, description, changed };
}
