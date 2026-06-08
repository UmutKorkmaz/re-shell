import { spawn } from 'node:child_process';

/**
 * Thin (NOT pure) helper that invokes the Re-Shell CLI to fetch the command
 * catalog. Kept out of src/core so the pure parsing/assembly modules stay
 * host- and process-free and unit-test without spawning anything.
 *
 * The argv is fixed (`commands list --json`); only the binary path and cwd are
 * variable, and both come from the extension's own configuration — never from a
 * tree node or user free-text. Spawned with `shell: false`.
 */
export interface RunCliResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export function fetchCommandCatalogRaw(cliBin: string, cwd: string): Promise<RunCliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cliBin, ['commands', 'list', '--json'], {
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
