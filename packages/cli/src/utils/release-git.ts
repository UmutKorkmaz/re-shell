// Release git helpers.
//
// Every git mutation and read goes through an INJECTABLE GitRunner so tests and
// the dry-run path never shell out to a real repository. The default runner uses
// `execFile` with an argv array (no shell interpolation), so refs, tags, and
// subdirectories can never be interpreted by a shell. Read helpers degrade to
// empty/null when git is unavailable; only a genuine "not a git repo" probe at
// the command's start is treated as a hard error by the caller.

/** Runs a git argv in `cwd` and resolves with trimmed stdout. Injectable. */
export type GitRunner = (args: string[], cwd: string) => Promise<string>;

/** Maximum stdout buffer for a git invocation (16 MiB). */
const GIT_MAX_BUFFER = 1 << 24;

/**
 * Default GitRunner: spawns `git` with an argv array via `execFile` (no shell),
 * returning trimmed stdout. Throws on a non-zero exit so callers can decide
 * whether to degrade (read helpers) or fail (repo probe).
 */
export const defaultGitRunner: GitRunner = async (args, cwd) => {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const run = promisify(execFile);
  const { stdout } = await run('git', args, { cwd, maxBuffer: GIT_MAX_BUFFER });
  return stdout.trim();
};

/** True when `cwd` is inside a git work tree. Used for the hard repo probe. */
export async function isGitRepo(run: GitRunner, cwd: string): Promise<boolean> {
  try {
    const out = await run(['rev-parse', '--is-inside-work-tree'], cwd);
    return out === 'true';
  } catch {
    return false;
  }
}

/**
 * The most recent tag (`git describe --tags --abbrev=0`), or null when there are
 * no tags / git is unavailable. Degrades to null rather than throwing.
 */
export async function lastTag(
  run: GitRunner,
  cwd: string
): Promise<string | null> {
  try {
    const out = await run(['describe', '--tags', '--abbrev=0'], cwd);
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Files changed since `ref` (the union of `git diff --name-only <ref>..HEAD` and
 * untracked files), as paths relative to the repo root with forward slashes.
 * When `ref` is null the diff is taken against the empty tree base (HEAD only is
 * not meaningful), so the caller treats a null ref as "everything changed"
 * upstream — here we simply return tracked+untracked vs HEAD. Degrades to an
 * empty list when git is unavailable.
 */
export async function changedFilesSince(
  run: GitRunner,
  cwd: string,
  ref: string | null
): Promise<string[]> {
  const collect = async (args: string[]): Promise<string[]> => {
    try {
      const out = await run(args, cwd);
      return out.split('\n').map(s => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  };

  const diffArgs = ref
    ? ['diff', '--name-only', `${ref}..HEAD`]
    : ['diff', '--name-only', 'HEAD'];

  const [tracked, untracked] = await Promise.all([
    collect(diffArgs),
    collect(['ls-files', '--others', '--exclude-standard']),
  ]);

  return [...new Set([...tracked, ...untracked])];
}

/**
 * Commit subjects since `ref` scoped to `subdir` (`git log <range> --pretty=%s
 * -- <subdir>`). When `ref` is null the whole history of `subdir` is used.
 * Degrades to an empty list when git is unavailable.
 */
export async function commitSubjectsSince(
  run: GitRunner,
  cwd: string,
  ref: string | null,
  subdir: string
): Promise<string[]> {
  try {
    const range = ref ? `${ref}..HEAD` : 'HEAD';
    const out = await run(
      ['log', range, '--pretty=format:%s', '--', subdir],
      cwd
    );
    return out.split('\n').map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Create an annotated tag (`git tag -a <tag> -m <message>`). Throws on failure
 * so the command layer can surface a RELEASE_ERROR (tagging is a real mutation,
 * not a best-effort read).
 */
export async function createAnnotatedTag(
  run: GitRunner,
  cwd: string,
  tag: string,
  message: string
): Promise<void> {
  await run(['tag', '-a', tag, '-m', message], cwd);
}
