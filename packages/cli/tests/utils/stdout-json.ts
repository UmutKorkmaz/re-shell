import { beforeEach, expect, vi } from 'vitest';

/**
 * Test helper for commands that emit a JSON envelope on stdout.
 *
 * Importing this module installs a `process.stdout.write` spy before every test
 * of the importing file (re-created each time, so `vi.restoreAllMocks()` in a
 * test's own afterEach is harmless). The spy records what reaches stdout and
 * passes nothing through, keeping the test run quiet.
 *
 * Commands now report `--json` results as one `{ ok, data, warnings }` line on
 * stdout (via `ok()`), not as raw `console.log` text, so assertions read the
 * envelope from here.
 */

let chunks: string[] = [];

beforeEach(() => {
  chunks = [];
  vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }) as never);
});

/** Everything written to stdout so far in the current test. */
export function stdoutText(): string {
  return chunks.join('');
}

/** Forget what has been captured so far. */
export function clearStdout(): void {
  chunks = [];
}

/** The parsed envelope. Asserts stdout holds exactly one single-line JSON document. */
export function jsonEnvelope(): {
  ok: boolean;
  data?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  error?: { code: string; message: string; details?: Record<string, unknown> };
  warnings: string[];
} {
  const lines = stdoutText()
    .split('\n')
    .filter(l => l.length > 0);
  expect(lines, `expected exactly one JSON envelope line on stdout, got: ${stdoutText()}`).toHaveLength(1);
  const env = JSON.parse(lines[0]);
  expect(typeof env.ok).toBe('boolean');
  expect(Array.isArray(env.warnings)).toBe(true);
  return env;
}

/** The `data` of a success envelope (asserts `ok: true`). */
export function jsonData(): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  const env = jsonEnvelope();
  expect(env.ok, JSON.stringify(env)).toBe(true);
  return env.data;
}

/** The `warnings` of the envelope. */
export function jsonWarnings(): string[] {
  return jsonEnvelope().warnings;
}
