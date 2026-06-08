import { spawn } from 'child_process';
import * as fs from 'fs';

export interface CommandResult {
  stdout: string[];
  stderr: string[];
  code: number;
}

export interface CommandOptions {
  cwd: string;
  timeout?: number;
}

/**
 * Spawn a CLI command and collect output, returning the exit code.
 * Streams output via callback for real-time display.
 */
export function runCommand(
  cmd: string[],
  opts: CommandOptions,
  onLine: (line: string) => void,
  onError: (line: string) => void
): Promise<number> {
  return new Promise((resolve) => {
    // Validate cwd exists before spawning
    if (!fs.existsSync(opts.cwd)) {
      onError(`Working directory does not exist: ${opts.cwd}`);
      resolve(1);
      return;
    }

    // Set up environment with color suppression
    const env = {
      ...process.env,
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      // Set NODE_ENV if not already set
      NODE_ENV: process.env.NODE_ENV || 'production',
    };

    const child = spawn(cmd[0], cmd.slice(1), {
      cwd: opts.cwd,
      env,
    });

    let timeoutId: NodeJS.Timeout | undefined;

    // Set up timeout handling
    if (opts.timeout && opts.timeout > 0) {
      timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        onError(`Command timed out after ${opts.timeout}ms`);
      }, opts.timeout);
    }

    child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      lines.forEach((line) => onLine(line));
    });

    child.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      lines.forEach((line) => onError(line));
    });

    child.on('close', (code, signal) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // A signal kill (e.g. SIGTERM from timeout) leaves `code` null; surface a
      // non-zero exit so callers can detect the failure (124 = timed out).
      resolve(code ?? (signal ? 124 : 0));
    });
    child.on('error', () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve(1);
    });
  });
}

// Reusable adapters for the hub server's main commands
export async function runWorkspaceHealth(
  cwd: string,
  onLine: (line: string) => void,
  onError: (line: string) => void
): Promise<number> {
  return runCommand(['re-shell', 'workspace', 'health', '--json'], { cwd }, onLine, onError);
}

export async function runWorkspaceGraph(
  cwd: string,
  onLine: (line: string) => void,
  onError: (line: string) => void
): Promise<number> {
  return runCommand(['re-shell', 'workspace', 'graph', '--json'], { cwd }, onLine, onError);
}

export async function runTemplateList(
  cwd: string,
  onLine: (line: string) => void,
  onError: (line: string) => void
): Promise<number> {
  return runCommand(['re-shell', 'templates', 'list', '--json'], { cwd }, onLine, onError);
}

export async function runWorkspaceInspect(
  cwd: string,
  onLine: (line: string) => void,
  onError: (line: string) => void
): Promise<number> {
  return runCommand(['re-shell', 'workspace', 'summary', '--json'], { cwd }, onLine, onError);
}

/** Shape of the CLI's JSON envelope (mirrors src/utils/json-output.ts). */
export interface JsonEnvelope<T = unknown> {
  ok: boolean;
  data?: T;
  warnings?: string[];
  error?: { code: string; message: string; details?: Record<string, unknown> };
}

/** Typed error surfaced when a hub adapter command fails. */
export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

/**
 * Run a CLI adapter command and parse its single-line JSON envelope.
 *
 * Surfaces a typed {@link AdapterError} when the process exits non-zero OR the
 * envelope reports `ok: false`, so both transport and domain failures are
 * caught. Returns the parsed `data` on success.
 */
export async function runJsonCommand<T = unknown>(
  cmd: string[],
  opts: CommandOptions
): Promise<T> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCommand(
    cmd,
    opts,
    (line) => stdout.push(line),
    (line) => stderr.push(line)
  );

  const raw = stdout.join('\n').trim();
  let envelope: JsonEnvelope<T> | undefined;
  if (raw) {
    try {
      envelope = JSON.parse(raw) as JsonEnvelope<T>;
    } catch {
      envelope = undefined;
    }
  }

  // Check BOTH the exit code and the envelope's ok flag.
  if (code !== 0 || !envelope || envelope.ok !== true) {
    const err = envelope?.error;
    throw new AdapterError(
      err?.message || stderr.join('\n') || `Command failed (exit ${code})`,
      err?.code || 'ADAPTER_COMMAND_FAILED',
      code,
      err?.details
    );
  }

  return envelope.data as T;
}
