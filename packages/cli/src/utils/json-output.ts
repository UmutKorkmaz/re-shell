import type {
  ErrorCode,
  JsonError,
  JsonResponse,
  JsonSuccess,
} from '@re-shell/contracts';

/**
 * Re-export the canonical wire-envelope types from the contracts package so the
 * CLI exposes a stable surface to its own modules. These are the single source
 * of truth (zod-backed in @re-shell/contracts); the CLI no longer declares
 * its own copies.
 *
 * - `ErrorCode`: Union of machine-readable error code strings.
 * - `JsonError`: Envelope shape for failure responses (`ok: false`).
 * - `JsonResponse`: Envelope shape for any response (success or failure).
 * - `JsonSuccess`: Envelope shape for success responses (`ok: true`).
 */
export type { ErrorCode, JsonError, JsonResponse, JsonSuccess };

/** Signature shared by `process.stdout.write` and `process.stderr.write`. */
type StreamWrite = (
  chunk: Uint8Array | string,
  encoding?: BufferEncoding | ((err?: Error | null) => void),
  callback?: (err?: Error | null) => void
) => boolean;

/**
 * Tracks whether JSON mode is currently active. Used by spinners/loggers that
 * want to route their output to stderr rather than rely on it being redirected
 * downstream.
 */
let jsonModeActive = false;

/**
 * The real `process.stdout.write`, captured when JSON mode is enabled. While
 * JSON mode is active this is the *only* path to stdout: `emitJson` writes
 * through it explicitly, and `process.stdout.write` itself is repointed at
 * stderr. There is no "gate" flag that opens and closes around a write.
 */
let stdoutSink: StreamWrite | null = null;

/** Number of envelopes written by `emitJson` in this process. */
let envelopesEmitted = 0;

/** True once the downstream reader closed stdout (EPIPE); nothing more can be delivered. */
let stdoutClosed = false;

/** True while a `--json` command run by the CLI entry point owes stdout exactly one envelope. */
let contractArmed = false;

/** True once the exit-time guard has been registered. */
let exitGuardInstalled = false;

/** Bounded tail of the incidental stdout text redirected to stderr, kept for diagnostics. */
let incidentalTail = '';
const INCIDENTAL_TAIL_LIMIT = 4000;

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001b\[[0-9;?]*[A-Za-z]/g;

function rememberIncidental(chunk: Uint8Array | string): void {
  const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
  incidentalTail = (incidentalTail + text).slice(-INCIDENTAL_TAIL_LIMIT);
}

/**
 * Returns true while a `--json` command is suppressing incidental stdout.
 *
 * @returns `true` if JSON mode is currently active, `false` otherwise.
 */
export function isJsonModeActive(): boolean {
  return jsonModeActive;
}

/**
 * Number of JSON envelopes this process has emitted through `emitJson`.
 *
 * @returns The running count; useful to assert the "exactly one document" contract.
 */
export function getEmittedEnvelopeCount(): number {
  return envelopesEmitted;
}

/**
 * Record that the downstream reader closed stdout (EPIPE). Further envelopes are
 * not written, because there is nobody left to read them.
 */
export function noteStdoutClosed(): void {
  stdoutClosed = true;
}

/**
 * Call this at the start of any --json command to keep stdout machine-readable.
 * Returns a restore function to call when done.
 *
 * Contract: while active, stdout carries *only* what `emitJson` (and therefore
 * ok/fail/jsonSuccess/jsonError) explicitly emits. Incidental stdout text from
 * the command, from `console.log`, or from a third-party library is **not
 * dropped**: it is redirected to stderr, so progress output and diagnostics stay
 * visible to a human (and to a log collector) without corrupting the document.
 *
 * Implementation note: this replaces a single property, `process.stdout.write`,
 * for the duration of the command. That one hook is unavoidable because
 * `console.log` and arbitrary libraries write to the process stdout stream
 * directly, so the only way to keep them off stdout is to repoint that write.
 * `console.*` itself is not patched (`console.warn`/`console.error` already
 * target stderr, and `console.log` reaches stdout through the same write).
 *
 * @returns A restore function that, when invoked, returns stdout to its original
 *   behavior and clears the JSON-mode flag. Calling `enableJsonMode` while
 *   already active is a no-op and returns a no-op restore (re-entrancy guard).
 */
export function enableJsonMode(): () => void {
  // Re-entrancy guard: nested enable calls must not double-patch or clobber the
  // original handle captured by the outermost call.
  if (jsonModeActive) {
    return () => {};
  }

  const originalWrite = process.stdout.write;
  const boundOriginalWrite = originalWrite.bind(process.stdout) as StreamWrite;

  jsonModeActive = true;
  stdoutSink = boundOriginalWrite;

  const redirectToStderr: StreamWrite = (chunk, encoding, callback) => {
    rememberIncidental(chunk);
    return (process.stderr.write as unknown as StreamWrite).call(
      process.stderr,
      chunk,
      encoding as never,
      callback as never
    );
  };
  process.stdout.write = redirectToStderr as typeof process.stdout.write;

  return () => {
    process.stdout.write = originalWrite;
    stdoutSink = null;
    jsonModeActive = false;
  };
}

/**
 * Write a single-line JSON envelope to stdout. This is the one place that
 * touches stdout in JSON mode so the contract (exactly one JSON object,
 * newline-terminated) stays centralized. Under JSON mode it writes through the
 * real stdout handle captured by `enableJsonMode`; otherwise it uses
 * `process.stdout.write` directly.
 *
 * @typeParam T - The payload type carried inside `data` when the envelope is a success.
 * @param res - The JSON response envelope (success or error) to serialize and emit.
 * @returns No return value; writes directly to stdout.
 */
export function emitJson<T>(res: JsonResponse<T>): void {
  envelopesEmitted += 1;
  if (stdoutClosed) {
    return;
  }
  const line = JSON.stringify(res) + '\n';
  if (stdoutSink) {
    stdoutSink(line);
  } else {
    process.stdout.write(line);
  }
}

/**
 * Emit a success envelope: { ok: true, data, warnings }.
 *
 * @typeParam T - The type of the success payload.
 * @param data - The success payload to place under `data`.
 * @param warnings - Optional non-fatal warning strings surfaced under `warnings`.
 *   Defaults to an empty array when omitted.
 * @returns No return value; emits the envelope to stdout via `emitJson`.
 */
export function ok<T>(data: T, warnings: string[] = []): void {
  emitJson<T>({ ok: true, data, warnings });
}

/**
 * Emit an error envelope and mark the process as failed (exitCode = 1).
 * `details` is omitted from the envelope when not provided so success/error
 * shapes stay minimal.
 *
 * @param code - Machine-readable error code from the `ErrorCode` union.
 * @param message - Human-readable error message describing what went wrong.
 * @param details - Optional structured details attached under `error.details`.
 *   When omitted, the `details` key is absent from the emitted envelope.
 * @returns No return value; emits the envelope to stdout via `emitJson` and
 *   sets `process.exitCode = 1`.
 */
export function fail(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): void {
  emitJson({
    ok: false,
    error: { code, message, ...(details ? { details } : {}) },
    warnings: [],
  });
  process.exitCode = 1;
}

/**
 * Emit an error envelope for a caught exception, using its message.
 *
 * @param error - The caught value (an `Error` or anything thrown).
 * @param code - Error code to report. Defaults to the generic `COMMAND_ERROR`.
 * @param details - Optional structured details; the error's `name` is added
 *   when it is more specific than plain `Error`.
 */
export function failFromError(
  error: unknown,
  code: ErrorCode = 'COMMAND_ERROR',
  details?: Record<string, unknown>
): void {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const named =
    error instanceof Error && error.name && error.name !== 'Error' ? { errorName: error.name } : {};
  const merged = { ...named, ...(details ?? {}) };
  fail(code, message || 'Unknown error', Object.keys(merged).length > 0 ? merged : undefined);
}

/**
 * Output a JSON success response.
 *
 * @typeParam T - The type of the success payload.
 * @param data - The success payload to place under `data`.
 * @param warnings - Optional non-fatal warning strings surfaced under `warnings`.
 *   Defaults to an empty array when omitted.
 * @returns No return value; emits a `JsonSuccess<T>` envelope to stdout via
 *   `emitJson`.
 */
export function jsonSuccess<T>(data: T, warnings: string[] = []): void {
  emitJson<T>({ ok: true, data, warnings } as JsonSuccess<T>);
}

/**
 * Output a JSON error response.
 *
 * Mirrors the success shape by always including `warnings`, omits `details`
 * when undefined, and marks the process as failed (exitCode = 1).
 *
 * @param code - Machine-readable error code from the `ErrorCode` union.
 * @param message - Human-readable error message describing what went wrong.
 * @param details - Optional structured details attached under `error.details`.
 *   When omitted, the `details` key is absent from the emitted envelope.
 * @returns No return value; emits a `JsonError` envelope to stdout via
 *   `emitJson` and sets `process.exitCode = 1`.
 */
export function jsonError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): void {
  const response: JsonError = {
    ok: false,
    error: { code, message, ...(details ? { details } : {}) },
    warnings: [],
  };
  emitJson(response);
  process.exitCode = 1;
}

function lastMeaningfulLine(text: string): string {
  const lines = text
    .replace(ANSI_PATTERN, '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
  return lines.length > 0 ? lines[lines.length - 1] : '';
}

/**
 * Emit the honest failure envelope for a `--json` command that ended without
 * producing one. Never claims success: the exit code is forced non-zero.
 */
function emitMissingEnvelopeFailure(exitCode: number): void {
  const output = incidentalTail.replace(ANSI_PATTERN, '').trim();
  const lastLine = lastMeaningfulLine(incidentalTail);
  const message =
    exitCode !== 0
      ? lastLine || `Command exited with code ${exitCode} without emitting a JSON result`
      : 'Command finished without emitting a JSON result';
  fail('COMMAND_ERROR', message, {
    exitCode,
    reason: 'no-json-result',
    ...(output ? { output } : {}),
  });
}

function exitGuard(code: number): void {
  if (!contractArmed || envelopesEmitted > 0 || stdoutClosed) {
    return;
  }
  contractArmed = false;
  const raw = process.exitCode;
  const effective = typeof raw === 'number' ? raw : code;
  emitMissingEnvelopeFailure(effective);
  // `fail` marks the process with exit code 1; a command that was already
  // exiting non-zero (e.g. 130 after Ctrl-C) keeps its own, more specific code.
  if (effective !== 0) {
    process.exitCode = effective;
  }
}

/**
 * Arm the single-envelope contract for the current process. Called by the CLI
 * entry point when the command being run declares `--json`. From now on a
 * `process.exit()` (or any other end of the process) that happens before an
 * envelope reached stdout is converted into an explicit
 * `{ ok: false, error: { code: "COMMAND_ERROR" } }` envelope with a non-zero exit
 * code, instead of leaving the consumer with empty or partial stdout.
 *
 * Library code and unit tests that call command handlers directly never arm
 * the contract, so it only ever applies to a real CLI invocation.
 */
export function armJsonContract(): void {
  contractArmed = true;
  if (!exitGuardInstalled) {
    exitGuardInstalled = true;
    process.on('exit', exitGuard);
  }
}

/**
 * Close the single-envelope contract after a command's action returned
 * normally: if the command emitted nothing, emit the honest failure envelope
 * now (and exit non-zero). Idempotent.
 */
export function settleJsonContract(): void {
  if (!contractArmed) {
    return;
  }
  contractArmed = false;
  if (envelopesEmitted === 0 && !stdoutClosed) {
    const raw = process.exitCode;
    const exitCode = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? 0), 10) || 0;
    emitMissingEnvelopeFailure(exitCode);
  }
}

/**
 * Reset module state. Test-only: lets unit tests start from a clean slate
 * without reloading the module.
 */
export function __resetJsonOutputStateForTests(): void {
  jsonModeActive = false;
  stdoutSink = null;
  envelopesEmitted = 0;
  stdoutClosed = false;
  contractArmed = false;
  incidentalTail = '';
}
