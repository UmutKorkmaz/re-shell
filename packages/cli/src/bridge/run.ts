// Shared command plumbing for the bridge subcommands: one JSON envelope on
// stdout in --json mode (ok:true data, or ok:false with an error code), human
// output otherwise, and a non-zero exit code on every failure.

import chalk from 'chalk';

import type { ErrorCode } from '@re-shell/contracts';
import { enableJsonMode, fail, ok } from '../utils/json-output';
import { BridgeSpecError } from './spec/errors';

/** Options for {@link runBridgeCommand}. */
export interface BridgeCommandSpec<T> {
  json?: boolean;
  /** Error code used when the command itself fails. */
  code: ErrorCode;
  /** Does the work. Throws on failure. */
  run: () => T | Promise<T>;
  /** Human-readable rendering of a successful result. */
  render: (data: T) => void;
  /** Non-zero exit for a *successful run with a negative verdict* (breaking diff, invalid workspace). */
  exitCode?: (data: T) => number;
  /** Warnings surfaced in the JSON envelope. */
  warnings?: (data: T) => string[];
}

function errorCodeFor(error: unknown, fallback: ErrorCode): ErrorCode {
  return error instanceof BridgeSpecError ? 'BRIDGE_SPEC_ERROR' : fallback;
}

/**
 * Run a bridge command with envelope + exit-code handling.
 *
 * In `--json` mode exactly one JSON document is written to stdout. A thrown
 * error becomes `{ok:false, error:{code,message}}` with exit code 1.
 */
export async function runBridgeCommand<T>(spec: BridgeCommandSpec<T>): Promise<void> {
  if (spec.json) {
    const restore = enableJsonMode();
    try {
      const data = await spec.run();
      ok(data, spec.warnings?.(data) ?? []);
      const code = spec.exitCode?.(data) ?? 0;
      if (code !== 0) process.exitCode = code;
    } catch (error: unknown) {
      fail(
        errorCodeFor(error, spec.code),
        error instanceof Error ? error.message : String(error),
        error instanceof BridgeSpecError ? error.details : undefined
      );
    } finally {
      restore();
    }
    return;
  }
  try {
    const data = await spec.run();
    spec.render(data);
    const code = spec.exitCode?.(data) ?? 0;
    if (code !== 0) process.exitCode = code;
  } catch (error: unknown) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exitCode = 1;
  }
}
