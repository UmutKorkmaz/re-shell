import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Interactive CLI test harness helpers.
 *
 * These commands resolve all file operations against `process.cwd()`, so each
 * interactive test runs inside an isolated `os.tmpdir()` workspace using a real
 * `process.chdir()`. Real chdir is only possible because the `tests/interactive`
 * suite is pinned to vitest's `child_process` pool (see vitest.config.ts);
 * `process.chdir()` is unsupported inside worker_threads.
 */

export interface TmpWorkspace {
  dir: string;
  cleanup: () => void;
}

/** Create an isolated temp workspace directory (realpath-resolved on macOS). */
export function makeTmpWorkspace(prefix = 're-shell-itest-'): TmpWorkspace {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  return {
    dir,
    cleanup: () => fs.removeSync(dir),
  };
}

/**
 * Run an async function with cwd switched into `dir` and console output muted,
 * always restoring both afterwards. Returns the function's result.
 */
export async function inWorkspace<T>(
  dir: string,
  fn: () => Promise<T>
): Promise<T> {
  const prevCwd = process.cwd();
  const origLog = console.log;
  const origWarn = console.warn;
  const origInfo = console.info;
  process.chdir(dir);
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  try {
    return await fn();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.info = origInfo;
    process.chdir(prevCwd);
  }
}
