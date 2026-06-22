import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

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

/**
 * Fetch the `re-shell workspace summary --json` payload. Fixed argv; only the
 * binary path and cwd vary (both from extension config).
 */
export function fetchWorkspaceSummaryRaw(cliBin: string, cwd: string): Promise<RunCliResult> {
  return runCli(cliBin, ['workspace', 'summary', '--json'], cwd);
}

/**
 * Fetch the `re-shell workspace graph --json` payload. Fixed argv.
 */
export function fetchWorkspaceGraphRaw(cliBin: string, cwd: string): Promise<RunCliResult> {
  return runCli(cliBin, ['workspace', 'graph', '--json'], cwd);
}

/**
 * Fetch the `re-shell workspace health --json` payload. Fixed argv.
 */
export function fetchWorkspaceHealthRaw(cliBin: string, cwd: string): Promise<RunCliResult> {
  return runCli(cliBin, ['workspace', 'health', '--json'], cwd);
}

/**
 * Fetch the `re-shell templates list --json` payload. Fixed argv.
 */
export function fetchTemplatesListRaw(cliBin: string, cwd: string): Promise<RunCliResult> {
  return runCli(cliBin, ['templates', 'list', '--json'], cwd);
}

/**
 * Fetch the `re-shell doctor --json` payload. Fixed argv.
 */
export function fetchDoctorRaw(cliBin: string, cwd: string): Promise<RunCliResult> {
  return runCli(cliBin, ['doctor', '--json'], cwd);
}

// ---------------------------------------------------------------------------
// CLI binary resolution
// ---------------------------------------------------------------------------

const HOME = os.homedir();

/** Identifier-safe bin name guard; the login-shell lookup interpolates this. */
const SAFE_BIN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function isExecutable(file: string): boolean {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return false;
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Common global bin directories where a globally-installed CLI may live. These
 * are usually added to PATH only by the user's interactive shell profile, so a
 * GUI-launched VS Code extension host (which inherits a minimal PATH) does not
 * see them. Probing them lets the extension find the CLI regardless of how VS
 * Code was launched.
 */
function candidateBinDirs(): string[] {
  const dirs = [
    path.join(HOME, '.hermes/node/bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    path.join(HOME, '.local/bin'),
    path.join(HOME, '.npm-global/bin'),
    path.join(HOME, '.bun/bin'),
    path.join(HOME, '.volta/bin'),
    path.join(HOME, '.deno/bin'),
    path.join(HOME, '.cargo/bin'),
    path.join(HOME, '.gem/bin'),
    path.join(HOME, '.grok/bin'),
  ];
  if (process.env.APPDATA) {
    dirs.push(path.join(process.env.APPDATA, 'npm'));
  }
  // nvm installs node versions under ~/.nvm/versions/node/<ver>/bin
  const nvmBase = path.join(HOME, '.nvm/versions/node');
  try {
    for (const ver of fs.readdirSync(nvmBase)) {
      dirs.push(path.join(nvmBase, ver, 'bin'));
    }
  } catch {
    // nvm not installed — ignore.
  }
  return dirs;
}

/** Prepend a discovered bin dir to PATH so later spawns resolve it too. */
function augmentPath(dir: string): void {
  const current = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  if (current.includes(dir)) return;
  process.env.PATH = [dir, ...current].join(path.delimiter);
}

/**
 * Ask the user's login shell where the binary lives. Reads the full interactive
 * shell profile, so it finds CLIs added in `.zshrc`/`.bashrc`. Only the bin
 * name (validated against a safe charset) is interpolated — never user free-text.
 */
function resolveViaLoginShell(binName: string): string | undefined {
  if (!SAFE_BIN.test(binName)) return undefined;
  if (process.platform === 'win32') return undefined;
  const shell = process.env.SHELL ?? '/bin/sh';
  try {
    const result = spawnSync(shell, ['-ilc', `command -v ${binName}`], {
      encoding: 'utf8',
      timeout: 5000,
    });
    const out = (result.stdout ?? '').split('\n')[0]?.trim() ?? '';
    if (out && isExecutable(out)) return out;
  } catch {
    // login shell unavailable — fall through.
  }
  return undefined;
}

/**
 * Resolve the Re-Shell CLI binary to an absolute, executable path. GUI-launched
 * VS Code on macOS inherits a minimal PATH that omits the user's shell profile
 * dirs (where globally-installed CLIs live). This probes common global bin
 * locations and falls back to the user's login shell so the extension can spawn
 * the CLI even when launched from the Dock.
 *
 * Side effect: if a bin dir is discovered, it is prepended to `process.env.PATH`
 * so every later `spawn(..., { shell: false })` finds the binary. The CLI argv
 * is always a fixed literal — only the binary path and PATH are touched.
 *
 * Returns the absolute binary path, or the original `cliBin` if not found (so
 * the caller's spawn produces the usual ENOENT error surface + diagnostics).
 */
export function resolveCliBin(cliBin: string, log?: (message: string) => void): string {
  // 1. Absolute path that exists and is executable.
  if (path.isAbsolute(cliBin)) {
    if (isExecutable(cliBin)) return cliBin;
    log?.(`[re-shell] configured cliBin "${cliBin}" is not executable; searching PATH`);
  }

  const binName = path.basename(cliBin);

  // 2. Already on the extension host's PATH.
  const pathDirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  for (const dir of pathDirs) {
    const candidate = path.join(dir, binName);
    if (isExecutable(candidate)) return candidate;
  }

  // 3. Probe common global bin locations; prepend the found dir to PATH.
  for (const dir of candidateBinDirs()) {
    const candidate = path.join(dir, binName);
    if (isExecutable(candidate)) {
      augmentPath(dir);
      log?.(`[re-shell] resolved CLI at ${candidate} (added ${dir} to PATH)`);
      return candidate;
    }
  }

  // 4. Last resort: ask the user's login shell where the binary lives.
  const loginResolved = resolveViaLoginShell(binName);
  if (loginResolved) {
    augmentPath(path.dirname(loginResolved));
    log?.(`[re-shell] resolved CLI via login shell at ${loginResolved}`);
    return loginResolved;
  }

  log?.(
    `[re-shell] could not resolve CLI "${binName}" on PATH or in common bin dirs. ` +
      'Set "reShell.cliBin" to the absolute path of your re-shell binary.'
  );
  return cliBin;
}
