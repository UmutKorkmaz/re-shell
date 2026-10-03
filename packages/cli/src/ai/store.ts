import * as fs from 'fs';
import * as path from 'path';

/**
 * Small filesystem helpers shared by the AI session store and semantic cache.
 *
 * Everything lives under `<workspace root>/.re-shell/ai/`. The directory gets a
 * `.gitignore` of `*` the first time it is created so prompts, sessions and
 * cached resolutions are never committed by accident.
 */

/** Directory (relative to the workspace root) holding all AI state. */
export const AI_STATE_DIR = path.join('.re-shell', 'ai');

/** Resolve the AI state directory for a workspace root. */
export function aiStateDir(root: string): string {
  return path.join(root, AI_STATE_DIR);
}

/**
 * Ensure a directory exists and that the AI state root ignores itself in git.
 *
 * @param dir - Directory to create (at or below the AI state dir).
 * @param stateRoot - The AI state root, where the `.gitignore` is placed.
 */
export function ensureStateDir(dir: string, stateRoot: string): void {
  fs.mkdirSync(dir, { recursive: true });
  const gitignore = path.join(stateRoot, '.gitignore');
  if (!fs.existsSync(gitignore)) {
    try {
      fs.writeFileSync(gitignore, '*\n', { encoding: 'utf8', flag: 'wx' });
    } catch {
      /* raced with another process, or read-only: harmless */
    }
  }
}

/**
 * Atomically write JSON (temp file + rename) so a crash or a concurrent reader
 * never observes a half-written file.
 *
 * @param file - Destination path.
 * @param value - Value to serialise.
 */
export function writeJsonAtomic(file: string, value: unknown): void {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * Read and parse a JSON file. Returns `undefined` for a missing or corrupt
 * file, so a damaged cache or session degrades to "empty" instead of failing
 * the command.
 *
 * @param file - File to read.
 * @returns The parsed value, or `undefined`.
 */
export function readJsonSafe<T>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return undefined;
  }
}
