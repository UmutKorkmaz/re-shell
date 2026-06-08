import { Writable } from 'stream';
import type {
  ErrorCode,
  JsonError,
  JsonResponse,
  JsonSuccess,
} from 're-shell-contracts';

/**
 * Re-export the canonical wire-envelope types from the contracts package so the
 * CLI exposes a stable surface to its own modules. These are the single source
 * of truth (zod-backed in re-shell-contracts); the CLI no longer declares
 * its own copies.
 */
export type { ErrorCode, JsonError, JsonResponse, JsonSuccess };

/**
 * When true, `emitJson` is permitted to write its envelope through the patched
 * stdout. Every other write is swallowed while JSON mode is active. This gate
 * replaces the old, fragile "does this string start with { or [?" sniff: the
 * single explicit emitter (`emitJson`) is the only sanctioned producer of
 * stdout bytes in JSON mode, so payloads that are Buffers, multi-line, or that
 * happen not to start with a brace are no longer dropped or leaked.
 */
let jsonEmitGateOpen = false;

/**
 * Tracks whether JSON mode is currently active. Used by spinners/loggers that
 * want to skip rendering entirely rather than rely on their output being
 * swallowed downstream.
 */
let jsonModeActive = false;

/**
 * Returns true while a `--json` command is suppressing incidental stdout.
 */
export function isJsonModeActive(): boolean {
  return jsonModeActive;
}

/**
 * Silences spinners and returns a write stream that only outputs valid JSON.
 * Use this in JSON mode to prevent spinner/banner noise from corrupting output.
 */
export function createJsonWriter(): Writable {
  return new Writable({
    write(chunk: Buffer, _encoding: string, callback: () => void) {
      // In JSON mode, only write the actual JSON output
      // Spinners should check isJsonWriter and skip output
      process.stdout.write(chunk.toString());
      callback();
    },
  });
}

/**
 * Call this at the start of any --json command to silence non-JSON output.
 * Returns a restore function to call when done.
 *
 * Hardened contract: while active, stdout carries *only* what `emitJson`
 * (and therefore ok/fail/jsonSuccess/jsonError) explicitly emits. There is no
 * prefix sniffing — incidental writes (banners, progress, library logging,
 * Buffers, multi-line text) are swallowed unconditionally so every JSON
 * command emits exactly one parseable document on stdout and nothing else.
 * Real errors are still surfaced on stderr so failures are never silently lost.
 */
export function enableJsonMode(): () => void {
  // Re-entrancy guard: nested enable calls must not double-patch or clobber the
  // original handles captured by the outermost call.
  if (jsonModeActive) {
    return () => {};
  }

  const originalWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  jsonModeActive = true;

  // Swallow every incidental stdout write. The only bytes allowed through are
  // those emitted while `jsonEmitGateOpen` is set, which `emitJson` toggles
  // around its single write. Signature mirrors stdout.write's overloads so the
  // assignment type-checks and callbacks/encoding are honoured for the gated path.
  const patchedWrite = ((
    chunk: Uint8Array | string,
    encoding?: BufferEncoding | ((err?: Error | null) => void),
    callback?: (err?: Error | null) => void
  ): boolean => {
    if (jsonEmitGateOpen) {
      return (originalWrite as (...args: unknown[]) => boolean)(
        chunk,
        encoding as never,
        callback as never
      );
    }
    // Suppressed: honour any provided callback so writers awaiting drain resolve.
    const cb = typeof encoding === 'function' ? encoding : callback;
    if (typeof cb === 'function') cb();
    return true;
  }) as typeof process.stdout.write;

  process.stdout.write = patchedWrite;

  console.log = () => {};
  console.warn = () => {};
  // Keep genuine errors visible on stderr (never on stdout, which must stay
  // pure JSON). Routing to stderr avoids silently swallowing real failures.
  console.error = (...args: unknown[]) => {
    const message = args
      .map(arg => (typeof arg === 'string' ? arg : String(arg)))
      .join(' ');
    originalStderrWrite(message + '\n');
  };

  return () => {
    process.stdout.write = originalWrite;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    jsonModeActive = false;
  };
}

/**
 * Write a single-line JSON envelope to stdout. This is the one place that
 * touches stdout so the contract (exactly one JSON object, newline-terminated)
 * stays centralized. The emit gate is opened only for this one write so that,
 * under JSON mode, exactly these bytes reach stdout and nothing else.
 */
export function emitJson<T>(res: JsonResponse<T>): void {
  const line = JSON.stringify(res) + '\n';
  const previous = jsonEmitGateOpen;
  jsonEmitGateOpen = true;
  try {
    process.stdout.write(line);
  } finally {
    jsonEmitGateOpen = previous;
  }
}

/**
 * Emit a success envelope: { ok: true, data, warnings }.
 */
export function ok<T>(data: T, warnings: string[] = []): void {
  emitJson<T>({ ok: true, data, warnings });
}

/**
 * Emit an error envelope and mark the process as failed (exitCode = 1).
 * `details` is omitted from the envelope when not provided so success/error
 * shapes stay minimal.
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
 * Output a JSON success response.
 */
export function jsonSuccess<T>(data: T, warnings: string[] = []): void {
  emitJson<T>({ ok: true, data, warnings } as JsonSuccess<T>);
}

/**
 * Output a JSON error response.
 *
 * Mirrors the success shape by always including `warnings`, omits `details`
 * when undefined, and marks the process as failed (exitCode = 1).
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

/**
 * Check if --json flag is present in argv
 */
export function isJsonMode(): boolean {
  return process.argv.includes('--json') || process.argv.includes('--json-output');
}
