// Thin git helpers for `fix --ci` (R-3). All calls are argv-based (no shell).

import { spawnSync } from 'child_process';
import * as path from 'path';
import { runProcess, type RunProcessResult } from './exec';

const GIT_ENV: NodeJS.ProcessEnv = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_EDITOR: 'true',
  LC_ALL: 'C',
};

export interface GitResult extends RunProcessResult {
  ok: boolean;
}

/** Run git in `cwd`; `ok` is true only for exit code 0. */
export async function git(cwd: string, args: string[], input?: string): Promise<GitResult> {
  const res = await runProcess(['git', ...args], { cwd, env: GIT_ENV, input, timeoutMs: 120_000 });
  return { ...res, ok: res.exitCode === 0 && !res.spawnError };
}

/** Run git and return trimmed stdout, or throw with git's stderr. */
export async function gitOut(cwd: string, args: string[]): Promise<string> {
  const res = await git(cwd, args);
  if (!res.ok) {
    throw new Error(`git ${args.join(' ')} failed: ${(res.stderr || res.spawnError || '').trim()}`);
  }
  return res.stdout.trim();
}

/** Absolute path of the repository's top level, or null when `cwd` is not in a work tree. */
export async function repoRoot(cwd: string): Promise<string | null> {
  const res = await git(cwd, ['rev-parse', '--show-toplevel']);
  if (!res.ok) return null;
  const top = res.stdout.trim();
  return top ? path.resolve(top) : null;
}

/** Porcelain status entries (path per entry), including untracked files. */
export async function dirtyFiles(root: string): Promise<string[]> {
  // Raw stdout: the first entry's leading space (" M file") is significant.
  const res = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  if (!res.ok) throw new Error(`git status failed: ${res.stderr.trim()}`);
  const parts = res.stdout.split('\0').filter(Boolean);
  const files: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    const code = entry.slice(0, 2);
    files.push(entry.slice(3));
    // Renames/copies carry the source path as a following NUL-separated field.
    if (code[0] === 'R' || code[0] === 'C') i++;
  }
  return files;
}

/** Current branch name, or null when HEAD is detached. */
export async function currentBranch(root: string): Promise<string | null> {
  const res = await git(root, ['symbolic-ref', '--short', '-q', 'HEAD']);
  return res.ok ? res.stdout.trim() || null : null;
}

export async function headSha(root: string): Promise<string> {
  return gitOut(root, ['rev-parse', 'HEAD']);
}

export async function branchExists(root: string, name: string): Promise<boolean> {
  const res = await git(root, ['show-ref', '--verify', '--quiet', `refs/heads/${name}`]);
  return res.ok;
}

/**
 * Best-effort default branch name: origin/HEAD when set, else main/master if
 * present locally, else null.
 */
export async function defaultBranch(root: string): Promise<string | null> {
  const sym = await git(root, ['symbolic-ref', '--short', '-q', 'refs/remotes/origin/HEAD']);
  if (sym.ok && sym.stdout.trim()) return sym.stdout.trim().replace(/^origin\//, '');
  for (const name of ['main', 'master']) {
    if (await branchExists(root, name)) return name;
  }
  return null;
}

export async function listRemotes(root: string): Promise<string[]> {
  const res = await git(root, ['remote']);
  return res.ok ? res.stdout.split('\n').map(s => s.trim()).filter(Boolean) : [];
}

/** Create and switch to a new branch at HEAD (carries any allowed dirty changes along). */
export async function createBranch(root: string, name: string): Promise<void> {
  const res = await git(root, ['switch', '-c', name]);
  if (!res.ok) throw new Error(`could not create branch ${name}: ${res.stderr.trim()}`);
}

/** Switch back to the starting point: a branch name, or a detached sha. */
export async function switchBack(root: string, branch: string | null, sha: string): Promise<void> {
  const res = branch ? await git(root, ['switch', branch]) : await git(root, ['switch', '--detach', sha]);
  if (!res.ok) throw new Error(`could not switch back to ${branch ?? sha}: ${res.stderr.trim()}`);
}

export async function deleteBranch(root: string, name: string): Promise<void> {
  await git(root, ['branch', '-D', name]);
}

/** `git apply --check` for a patch fed on stdin. */
export async function applyCheck(root: string, patch: string): Promise<GitResult> {
  return git(root, ['apply', '--check', '--recount', '--whitespace=nowarn', '-'], patch);
}

/** Apply a patch (stdin) to the work tree only. */
export async function applyPatch(root: string, patch: string): Promise<GitResult> {
  return git(root, ['apply', '--recount', '--whitespace=nowarn', '-'], patch);
}

/** Reverse-apply a patch (stdin): the exact inverse of {@link applyPatch}. */
export async function reversePatch(root: string, patch: string): Promise<GitResult> {
  return git(root, ['apply', '-R', '--recount', '--whitespace=nowarn', '-'], patch);
}

export interface NumstatEntry {
  path: string;
  additions: number;
  deletions: number;
}

/** Per-file additions/deletions for a patch, as git itself counts them. */
export async function numstat(root: string, patch: string): Promise<NumstatEntry[] | null> {
  const res = await git(root, ['apply', '--numstat', '--recount', '-'], patch);
  if (!res.ok) return null;
  const entries: NumstatEntry[] = [];
  for (const line of res.stdout.split('\n')) {
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
    if (!m) continue;
    entries.push({
      path: m[3],
      additions: m[1] === '-' ? 0 : Number(m[1]),
      deletions: m[2] === '-' ? 0 : Number(m[2]),
    });
  }
  return entries;
}

/** True when user.name and user.email are both configured. */
async function hasIdentity(root: string): Promise<boolean> {
  const name = await git(root, ['config', 'user.name']);
  const email = await git(root, ['config', 'user.email']);
  return name.ok && name.stdout.trim() !== '' && email.ok && email.stdout.trim() !== '';
}

/**
 * Commit exactly `files` (pathspec-limited, so unrelated staged/dirty changes
 * are never swept in). Supplies a one-off identity via `-c` only when none is
 * configured; git config itself is never modified.
 */
export async function commitFiles(root: string, files: string[], message: string): Promise<string> {
  const add = await git(root, ['add', '-A', '--', ...files]);
  if (!add.ok) throw new Error(`git add failed: ${add.stderr.trim()}`);
  const identity = (await hasIdentity(root))
    ? []
    : ['-c', 'user.name=re-shell fix', '-c', 'user.email=re-shell-fix@localhost'];
  const res = await git(root, [...identity, 'commit', '-m', message, '--', ...files]);
  if (!res.ok) throw new Error(`git commit failed: ${(res.stderr || res.stdout).trim()}`);
  return headSha(root);
}

/** Contents of `path` at HEAD, or null when it does not exist there. */
export async function showHead(root: string, relPath: string): Promise<string | null> {
  const res = await git(root, ['show', `HEAD:${relPath}`]);
  return res.ok ? res.stdout : null;
}

/**
 * Synchronous best-effort restore used from signal handlers, where async work
 * cannot be awaited: reverse-apply `patches` (newest first), switch back to the
 * starting point and delete the work branch.
 */
export function emergencyRestoreSync(
  root: string,
  patchesNewestFirst: readonly string[],
  startBranch: string | null,
  startSha: string,
  workBranch: string,
  keepBranch = false
): void {
  const run = (args: string[], input?: string): void => {
    spawnSync('git', args, { cwd: root, input, env: { ...process.env, ...GIT_ENV }, stdio: ['pipe', 'ignore', 'ignore'] });
  };
  for (const patch of patchesNewestFirst) {
    run(['apply', '-R', '--recount', '--whitespace=nowarn', '-'], patch);
  }
  run(startBranch ? ['switch', startBranch] : ['switch', '--detach', startSha]);
  if (!keepBranch) run(['branch', '-D', workBranch]);
}
