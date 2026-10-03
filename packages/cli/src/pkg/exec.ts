// Process execution for pkg commands: argv only, never a shell string.

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import type { PlannedCommand } from './types';

export interface ExecResult {
  /** null when the process was killed by a signal or failed to spawn. */
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Spawn failure message (e.g. ENOENT), when exitCode is null. */
  error?: string;
  durationMs: number;
}

export interface ExecOptions {
  /** Mirror child output to this process's stdout/stderr while capturing it. */
  stream?: boolean;
  env?: NodeJS.ProcessEnv;
}

export type Executor = (command: PlannedCommand, options?: ExecOptions) => Promise<ExecResult>;

const MAX_CAPTURE = 16 * 1024 * 1024;

/** Locate an executable on PATH (honouring PATHEXT on Windows). */
export function findExecutable(name: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const hasSep = name.includes('/') || name.includes('\\');
  const exts =
    process.platform === 'win32'
      ? ['', ...(env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').map(e => e.toLowerCase())]
      : [''];
  const dirs = hasSep ? [''] : (env.PATH ?? '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = hasSep ? name + ext : path.join(dir, name + ext);
      try {
        const st = fs.statSync(candidate);
        if (st.isFile()) {
          if (process.platform === 'win32') return candidate;
          fs.accessSync(candidate, fs.constants.X_OK);
          return candidate;
        }
      } catch {
        /* keep looking */
      }
    }
  }
  return null;
}

/** Characters we accept in args when a Windows .cmd shim forces cmd.exe. */
const WIN_SAFE_ARG = /^[A-Za-z0-9_@:./\\=+,~^-][A-Za-z0-9_@:./\\=+,~ ^-]*$/;

/** Default executor: spawn(file, args, { shell: false }). */
export const defaultExecutor: Executor = (command, options = {}) =>
  new Promise<ExecResult>(resolve => {
    const started = Date.now();
    const env = options.env ?? process.env;
    const [tool, ...args] = command.argv;
    const resolved = findExecutable(tool, env);
    if (!resolved) {
      resolve({ exitCode: null, stdout: '', stderr: '', error: `ENOENT: ${tool} not found on PATH`, durationMs: 0 });
      return;
    }
    let file = resolved;
    let spawnArgs = args;
    let useShell = false;
    if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolved)) {
      if (!args.every(a => WIN_SAFE_ARG.test(a))) {
        resolve({
          exitCode: null,
          stdout: '',
          stderr: '',
          error: `Refusing to pass unsafe characters through cmd.exe for ${tool}`,
          durationMs: 0,
        });
        return;
      }
      file = `"${resolved}"`;
      spawnArgs = args.map(a => (a.includes(' ') ? `"${a}"` : a));
      useShell = true;
    }
    const child = spawn(file, spawnArgs, {
      cwd: command.cwd,
      env,
      shell: useShell,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => {
      if (stdout.length < MAX_CAPTURE) stdout += d.toString('utf8');
      if (options.stream) process.stdout.write(d);
    });
    child.stderr.on('data', (d: Buffer) => {
      if (stderr.length < MAX_CAPTURE) stderr += d.toString('utf8');
      if (options.stream) process.stderr.write(d);
    });
    child.on('error', err => {
      resolve({ exitCode: null, stdout, stderr, error: err.message, durationMs: Date.now() - started });
    });
    child.on('close', code => {
      resolve({ exitCode: code, stdout, stderr, durationMs: Date.now() - started });
    });
  });
