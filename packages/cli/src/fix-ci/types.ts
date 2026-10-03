// Shared types for the real `fix --ci` implementation (R-3).

import type { FixCiFailingEntry, FixCiGateKind, FixCiGateResult } from '@re-shell/contracts';

export type { FixCiFailingEntry, FixCiGateKind, FixCiGateResult };

/** JSON error codes the real fix --ci pipeline can raise as hard failures. */
export type FixCiErrorCode =
  | 'FIX_CI_ERROR'
  | 'FIX_CI_NOT_A_REPO'
  | 'FIX_CI_DIRTY_TREE'
  | 'FIX_CI_CONFIG_INVALID'
  | 'FIX_CI_NO_GATES'
  | 'FIX_CI_NO_PROVIDER'
  | 'FIX_CI_GATES_RED';

/** Thrown for preconditions / configuration problems; carries a JSON error code. */
export class FixCiError extends Error {
  constructor(
    public readonly code: FixCiErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FixCiError';
  }
}

/** Which output parser interprets a gate's failures. */
export type GateParser = 'tsc' | 'vitest' | 'jest' | 'eslint' | 'generic';

/** A fully resolved gate definition. */
export interface GateDefinition {
  name: string;
  kind: FixCiGateKind;
  /** argv, executed without a shell. */
  command: string[];
  /** Locked gates can never be skipped and must pass. Tests are always locked. */
  locked: boolean;
  timeoutMs: number;
  parser?: GateParser;
}

export interface PatchLimits {
  maxBytes: number;
  maxFiles: number;
  maxChangedLines: number;
}

export interface ResolvedFixCiConfig {
  /** Where the gate definitions came from. */
  source: string;
  gates: GateDefinition[];
  /** Extra workspace-relative globs the model may never modify. */
  protectedPaths: string[];
  limits: PatchLimits;
  warnings: string[];
}

export const DEFAULT_GATE_TIMEOUT_MS = 10 * 60 * 1000;

export const DEFAULT_PATCH_LIMITS: PatchLimits = {
  maxBytes: 200_000,
  maxFiles: 20,
  maxChangedLines: 1500,
};
