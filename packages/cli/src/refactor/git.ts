// Minimal git helpers (execFile, no shell) for the refactor commands.

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface GitInfo {
  inRepo: boolean;
  /** Repository top-level directory, when inRepo. */
  toplevel?: string;
  dirty: boolean;
  /** `git status --porcelain` lines scoped to the directory. */
  dirtyEntries: string[];
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Describe the git state of `dir` (not a repo / git missing => inRepo:false). */
export function gitInfo(dir: string): GitInfo {
  try {
    const toplevel = git(dir, ['rev-parse', '--show-toplevel']).trim();
    const status = git(dir, ['status', '--porcelain', '--untracked-files=normal', '--', '.'])
      .split('\n')
      .filter(l => l.length > 0);
    return { inRepo: true, toplevel: fs.realpathSync(toplevel), dirty: status.length > 0, dirtyEntries: status };
  } catch {
    return { inRepo: false, dirty: false, dirtyEntries: [] };
  }
}

/** True when `abs` (file or directory) has tracked content in the repo. */
export function isTracked(repoRoot: string, abs: string): boolean {
  try {
    const out = git(repoRoot, ['ls-files', '--', path.relative(repoRoot, abs)]);
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

export type MoveMethod = 'git-mv' | 'fs-rename';

/**
 * Move `from` to `to`. Uses `git mv` for tracked content so history/renames are
 * recorded, falling back to a plain rename (untracked files, or no repo).
 */
export function moveWithGit(repoRoot: string | undefined, from: string, to: string): MoveMethod {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (repoRoot && isTracked(repoRoot, from)) {
    git(repoRoot, ['mv', '--', path.relative(repoRoot, from), path.relative(repoRoot, to)]);
    return 'git-mv';
  }
  fs.renameSync(from, to);
  return 'fs-rename';
}
