import fs from 'node:fs';
import path from 'node:path';

/**
 * Filesystem containment for the execution worker.
 *
 * Two layers, both symlink-aware (paths are realpath'd, so a symlink that points
 * outside the allowed directory cannot be used to escape):
 *
 *  1. {@link resolveWorkspaceDir}: the control plane names a workspace by id; the
 *     worker maps it to `<workspaceRoot>/<id>` and requires the real path to be a
 *     directory INSIDE the real workspace root.
 *  2. {@link containCwd}: a command's optional `cwd` param is resolved relative
 *     to that workspace directory and must stay inside it.
 *
 * The cwd logic mirrors `containCwd` in apps/web/src/hub-server.ts (the local
 * hub); both exist because that function is private to the hub bundle.
 */

/** Realpath a directory if it exists, else fall back to its lexical resolution. */
function safeRealpath(dir: string): string {
  try {
    return fs.realpathSync(dir);
  } catch {
    return path.resolve(dir);
  }
}

function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return !(rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel));
}

/**
 * Contain a requested cwd to `base`. Returns the resolved absolute path, or null
 * when the request escapes `base`.
 */
export function containCwd(requested: string | undefined, base: string): string | null {
  const root = safeRealpath(base);
  if (requested === undefined) {
    return root;
  }
  const candidate = path.isAbsolute(requested)
    ? path.resolve(requested)
    : path.resolve(root, requested);
  const realCandidate = safeRealpath(candidate);
  return isInside(root, realCandidate) ? realCandidate : null;
}

export type WorkspaceDirResult =
  | { ok: true; dir: string }
  | { ok: false; reason: string };

/**
 * Map a workspace id to its directory under `workspaceRoot`. The id is expected
 * to be a validated single path token (the control plane's id schema forbids
 * separators and dot-only ids), but it is re-checked here: the worker never
 * trusts that the server did.
 */
export function resolveWorkspaceDir(workspaceRoot: string, workspaceId: string): WorkspaceDirResult {
  if (
    workspaceId.length === 0 ||
    workspaceId === '.' ||
    workspaceId === '..' ||
    /[\\/\0]/.test(workspaceId)
  ) {
    return { ok: false, reason: 'Workspace id is not a plain directory name.' };
  }
  const root = safeRealpath(workspaceRoot);
  let real: string;
  try {
    real = fs.realpathSync(path.join(root, workspaceId));
  } catch {
    return { ok: false, reason: 'Workspace directory does not exist on this worker.' };
  }
  if (!isInside(root, real) || real === root) {
    return { ok: false, reason: 'Workspace directory resolves outside the workspace root.' };
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(real);
  } catch {
    return { ok: false, reason: 'Workspace directory is not accessible.' };
  }
  if (!stat.isDirectory()) {
    return { ok: false, reason: 'Workspace path is not a directory.' };
  }
  return { ok: true, dir: real };
}

/**
 * The invocation prefix for the re-shell CLI. Only ever the CLI binary — never
 * an arbitrary command from a job. A JS entry runs under the current Node.
 */
export function resolveCliInvocation(cliBin: string): string[] {
  const looksLikeJsEntry = /\.[cm]?js$/i.test(cliBin) || cliBin.includes(path.sep);
  return looksLikeJsEntry ? [process.execPath, cliBin] : [cliBin];
}

/**
 * The environment handed to the spawned CLI: a small allow-list. The worker's
 * own environment holds its bearer token (CONTROL_PLANE_*), which a child
 * process must never inherit.
 */
export function childEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const allowed = ['PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot'];
  const env: NodeJS.ProcessEnv = { NO_COLOR: '1', FORCE_COLOR: '0', TERM: 'dumb', CI: '1' };
  for (const key of allowed) {
    const value = source[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}
