import { spawn } from 'node:child_process';

/**
 * Thin (NOT pure) helper that invokes the Re-Shell CLI. Kept out of src/core so
 * the pure parsing/assembly modules stay host- and process-free and unit-test
 * without spawning anything.
 *
 * The argv is always a FIXED literal (`commands list --json`, `workspace health
 * --json`); only the binary path and cwd are variable, and both come from the
 * extension's own configuration — never from a tree node or user free-text.
 * Spawned with `shell: false`.
 */
export interface RunCliResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Run a fixed-argv Re-Shell CLI invocation and capture its output. The argv is
 * always a literal array (no shell interpolation); values that vary are limited
 * to the binary path and the working directory, both sourced from extension
 * config, never from user free-text.
 */
export function runCli(cliBin: string, argv: readonly string[], cwd: string): Promise<RunCliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cliBin, [...argv], {
      cwd,
      shell: false,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/**
 * Fetch the `re-shell commands list --json` payload. Thin wrapper over
 * {@link runCli} with the catalog argv fixed.
 */
export function fetchCommandCatalogRaw(cliBin: string, cwd: string): Promise<RunCliResult> {
  return runCli(cliBin, ['commands', 'list', '--json'], cwd);
}
