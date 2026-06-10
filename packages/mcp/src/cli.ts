import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { jsonResponseSchema, type JsonResponse } from '@re-shell/contracts';
import { z } from 'zod';

/**
 * Maximum bytes of stdout we buffer from a single CLI invocation before giving
 * up. Read-only JSON envelopes are small; this guards against a runaway child.
 */
const MAX_STDOUT_BYTES = 8 * 1024 * 1024;

/**
 * Default wall-clock budget for a single CLI invocation. The CLI's own
 * commands apply their own internal timeouts; this is a backstop so a wedged
 * child can never hang the MCP server forever.
 */
const DEFAULT_TIMEOUT_MS = 120_000;

const require = createRequire(import.meta.url);

/**
 * The re-shell CLI invocation prefix: the Node executable followed by the
 * absolute path to the CLI's `dist/index.js` entry. argv is always built as a
 * fixed array on top of this prefix — never a shell string.
 */
export interface CliInvocation {
  /** The argv prefix, e.g. `[process.execPath, '/abs/path/dist/index.js']`. */
  readonly prefix: readonly string[];
  /** How the entry was resolved, for diagnostics. */
  readonly strategy: 'RE_SHELL_BIN' | 'require.resolve' | 'workspace-fallback';
  /** The resolved CLI entry path. */
  readonly entry: string;
}

/**
 * Resolve the re-shell CLI entry point.
 *
 * Resolution order:
 *   1. `RE_SHELL_BIN` env var — an explicit path to the CLI's JS entry.
 *   2. `require.resolve('@re-shell/cli')` — the installed package's main.
 *   3. A workspace fallback to `packages/cli/dist/index.js` relative to this
 *      file (works when run uncompiled-but-built from the monorepo).
 *
 * The CLI is a JS entry, so it is always executed under the current Node
 * runtime (`process.execPath`); we never invoke a bare command name or a shell.
 */
export function resolveCli(): CliInvocation {
  const fromEnv = process.env.RE_SHELL_BIN;
  if (fromEnv && fromEnv.trim().length > 0) {
    const entry = path.resolve(fromEnv.trim());
    if (!fs.existsSync(entry)) {
      throw new Error(`RE_SHELL_BIN points at a missing file: ${entry}`);
    }
    return { prefix: [process.execPath, entry], strategy: 'RE_SHELL_BIN', entry };
  }

  try {
    const entry = require.resolve('@re-shell/cli');
    return { prefix: [process.execPath, entry], strategy: 'require.resolve', entry };
  } catch {
    // Fall through to the workspace fallback below.
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  // dist/cli.js -> packages/mcp -> packages -> packages/cli/dist/index.js
  const fallback = path.resolve(here, '..', '..', 'cli', 'dist', 'index.js');
  if (!fs.existsSync(fallback)) {
    throw new Error(
      'Unable to resolve the @re-shell/cli entry. Set RE_SHELL_BIN to the CLI dist/index.js path, ' +
        'or build @re-shell/cli so packages/cli/dist/index.js exists.'
    );
  }
  return { prefix: [process.execPath, fallback], strategy: 'workspace-fallback', entry: fallback };
}

/** Raw outcome of running the CLI: captured streams plus the exit code. */
interface CliRunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

/**
 * Run the resolved CLI with a FIXED argv array (no shell). `args` are the
 * subcommand tokens and flags only — the binary prefix is prepended here.
 */
function runCli(invocation: CliInvocation, args: readonly string[]): Promise<CliRunResult> {
  return new Promise((resolve, reject) => {
    const [bin, ...prefixArgs] = invocation.prefix;
    const child = spawn(bin, [...prefixArgs, ...args], {
      // Never run through a shell; argv elements are passed literally.
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`re-shell CLI timed out after ${DEFAULT_TIMEOUT_MS}ms: ${args.join(' ')}`));
    }, DEFAULT_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          child.kill('SIGKILL');
          reject(new Error('re-shell CLI produced more output than the MCP server will buffer.'));
        }
        return;
      }
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 0 });
    });
  });
}

/**
 * A validated CLI result: the parsed, schema-checked envelope plus the raw
 * exit code. The envelope's own `ok` discriminant carries success/error.
 */
export interface ValidatedEnvelope<T> {
  readonly envelope: JsonResponse<T>;
  readonly exitCode: number;
}

/**
 * Run a read-only CLI command and validate its stdout against the canonical
 * `{ ok, data, warnings }` / `{ ok, error, warnings }` envelope, parameterized
 * by `dataSchema`.
 *
 * Throws on: non-JSON stdout, an envelope that fails schema validation, or a
 * spawn/timeout failure. A non-zero exit that still produced a valid ERROR
 * envelope is returned (not thrown) so the caller can surface the CLI's own
 * structured error code/message.
 */
export async function runJsonCommand<T extends z.ZodTypeAny>(
  invocation: CliInvocation,
  args: readonly string[],
  dataSchema: T
): Promise<ValidatedEnvelope<z.infer<T>>> {
  const result = await runCli(invocation, args);

  const trimmed = result.stdout.trim();
  if (trimmed.length === 0) {
    const detail = result.stderr.trim();
    throw new Error(
      `re-shell CLI returned no JSON (exit ${result.code}).${detail ? ` stderr: ${detail}` : ''}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(
      `re-shell CLI output was not valid JSON (exit ${result.code}): ${trimmed.slice(0, 500)}`
    );
  }

  const schema = jsonResponseSchema(dataSchema);
  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `re-shell CLI output did not match the expected envelope: ${validated.error.message}`
    );
  }

  return { envelope: validated.data as JsonResponse<z.infer<T>>, exitCode: result.code };
}
