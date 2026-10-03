// Patch parsing + validation for `fix --ci` (R-3).
//
// A model-proposed patch is untrusted input. Before anything touches the work
// tree it must:
//   - be non-empty and within size limits,
//   - only add/modify/delete regular text files (no renames, mode changes,
//     symlinks or binary patches),
//   - only touch files inside the workspace (no `..`, absolute paths, `.git`,
//     `node_modules`, or symlink escapes),
//   - NEVER modify test files, test/type/lint configuration, the fix-ci gate
//     config or CI definitions (that would "fix" CI by weakening the gates),
//   - not add suppression directives (@ts-ignore, eslint-disable, ...),
//   - apply cleanly (`git apply --check`).

import * as fs from 'fs';
import * as path from 'path';
import * as git from './git';
import type { PatchLimits } from './types';

export interface PatchFileStat {
  path: string;
  additions: number;
  deletions: number;
}

export interface PatchValidationContext {
  repoRoot: string;
  /** Workspace directory relative to the repo root ('' when they coincide). */
  workspaceRel: string;
  limits: PatchLimits;
  /** Extra workspace-relative globs (from config) the patch may never touch. */
  protectedGlobs: readonly string[];
  /** Repo-relative paths with uncommitted user changes (--allow-dirty); patches may not touch them. */
  dirtyPaths?: ReadonlySet<string>;
}

export type PatchValidation =
  | { ok: true; patch: string; files: PatchFileStat[]; additions: number; deletions: number }
  | { ok: false; reason: string };

/**
 * Pull a unified diff out of raw model output: strips markdown fences and any
 * prose before the first diff header, and guarantees a trailing newline.
 */
export function extractPatch(raw: string): string {
  let text = raw.replace(/\r\n?/g, '\n');
  const fence = /```(?:diff|patch)?\n([\s\S]*?)\n```/.exec(text);
  if (fence) text = fence[1];
  const start = text.search(/^(diff --git |--- )/m);
  if (start === -1) return text.trim() === '' ? '' : text;
  text = text.slice(start);
  return text.endsWith('\n') ? text : `${text}\n`;
}

// ---------------------------------------------------------------------------
// header parsing
// ---------------------------------------------------------------------------

interface ParsedHeaders {
  paths: string[];
  problems: string[];
  addedLines: string[];
}

function stripPrefix(p: string): string {
  // git apply's default -p1: drop the leading `a/` or `b/` component.
  const idx = p.indexOf('/');
  return idx === -1 ? p : p.slice(idx + 1);
}

function cleanHeaderPath(raw: string): string {
  // `--- a/path\t<timestamp>` style trailers.
  return raw.split('\t')[0].trim();
}

/** Parse the file headers of a unified diff the way `git apply` (-p1) reads them. */
export function parseHeaders(patch: string): ParsedHeaders {
  const paths = new Set<string>();
  const problems: string[] = [];
  const addedLines: string[] = [];
  let sawHunk = false;
  let sawFileHeader = false;
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) {
      sawFileHeader = true;
      if (line.includes('"')) {
        problems.push('quoted/escaped paths in diff headers are not supported');
        continue;
      }
      const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      if (!m) {
        problems.push(`unparseable diff header: ${line.slice(0, 120)}`);
        continue;
      }
      if (m[1] !== m[2]) problems.push(`renames/copies are not allowed (${m[1]} -> ${m[2]})`);
      paths.add(m[1]);
      paths.add(m[2]);
    } else if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      if (!sawHunk || /^(---|\+\+\+) (a\/|b\/|\/dev\/null)/.test(line)) {
        const p = cleanHeaderPath(line.slice(4));
        if (p === '/dev/null') {
          /* creation / deletion side */
        } else {
          sawFileHeader = true;
          if (p.includes('"')) problems.push('quoted/escaped paths in diff headers are not supported');
          else paths.add(stripPrefix(p));
        }
        if (line.startsWith('+++ ')) sawHunk = false;
      } else if (line.startsWith('+') && !line.startsWith('+++ ')) {
        addedLines.push(line.slice(1));
      }
    } else if (line.startsWith('@@')) {
      sawHunk = true;
    } else if (/^(rename|copy) (from|to) /.test(line) || /^similarity index /.test(line)) {
      problems.push('renames/copies are not allowed');
    } else if (/^(old|new) mode /.test(line) || /^(new|deleted) file mode (?!100644)/.test(line)) {
      problems.push(`mode changes and non-regular files are not allowed (${line.trim()})`);
    } else if (/^GIT binary patch/.test(line) || /^Binary files /.test(line)) {
      problems.push('binary patches are not allowed');
    } else if (sawHunk && line.startsWith('+')) {
      addedLines.push(line.slice(1));
    }
  }
  if (!sawFileHeader || paths.size === 0) {
    problems.push('no file headers (`diff --git a/x b/x`, `--- a/x`, `+++ b/x`) found: not a unified diff');
  }
  return { paths: [...paths], problems, addedLines };
}

// ---------------------------------------------------------------------------
// path policy
// ---------------------------------------------------------------------------

const TEST_FILE_PATTERNS: RegExp[] = [
  /(^|\/)(__tests__|__mocks__|__snapshots__|__fixtures__|tests?|specs?|e2e|cypress|fixtures?|testdata)\//,
  /\.(test|spec)\.[^/]+$/,
  /[._-](test|spec)\.[^/]+$/,
  /(^|\/)test_[^/]*\.py$/,
  /[A-Za-z]Tests?\.(java|kt|cs|scala|swift)$/,
  /\.snap$/,
];

const PROTECTED_CONFIG_PATTERNS: Array<{ re: RegExp; what: string }> = [
  { re: /(^|\/)(vitest|jest|playwright|karma|cypress)(\.[^/]+)*\.(config|setup|workspace)(\.[^/]+)*$/, what: 'test runner config' },
  { re: /(^|\/)(vitest|jest)\.[^/]+$/, what: 'test runner config' },
  { re: /(^|\/)\.mocharc[^/]*$/, what: 'test runner config' },
  { re: /(^|\/)tsconfig[^/]*\.json$/, what: 'TypeScript config' },
  { re: /(^|\/)(\.eslintrc[^/]*|eslint\.config\.[^/]+|\.eslintignore)$/, what: 'lint config' },
  { re: /(^|\/)\.re-shell\//, what: 'fix-ci gate config' },
  { re: /(^|\/)re-shell\.workspaces\.ya?ml$/, what: 'workspace/gate config' },
  { re: /(^|\/)\.(github|gitlab|circleci|husky)\//, what: 'CI/hook definitions' },
  { re: /(^|\/)\.gitlab-ci\.ya?ml$/, what: 'CI definitions' },
];

/** Convert a small glob (`**`, `*`, `?`) to an anchored RegExp. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

/**
 * Why a repo-relative path may not be modified, or null when it may.
 * Exported for tests.
 */
export function pathViolation(repoRelPath: string, ctx: PatchValidationContext): string | null {
  const p = repoRelPath;
  if (!p || p.includes('\0')) return 'empty or invalid path';
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p) || p.includes('\\')) {
    return `absolute or non-posix path "${p}"`;
  }
  const segments = p.split('/');
  if (segments.some(s => s === '..' || s === '.' || s === '')) return `path "${p}" is not normalised (contains ".." or empty segments)`;
  if (segments.includes('.git')) return `path "${p}" is inside .git`;
  const ws = ctx.workspaceRel;
  if (ws && p !== ws && !p.startsWith(`${ws}/`)) return `path "${p}" is outside the workspace (${ws}/)`;
  const wp = ws ? p.slice(ws.length + 1) : p;
  if (segments.includes('node_modules')) return `path "${p}" is inside node_modules`;
  if (TEST_FILE_PATTERNS.some(re => re.test(wp))) return `"${p}" is a test file: patches may never modify tests`;
  for (const { re, what } of PROTECTED_CONFIG_PATTERNS) {
    if (re.test(wp)) return `"${p}" is ${what}: patches may never modify the gates`;
  }
  for (const glob of ctx.protectedGlobs) {
    if (globToRegExp(glob).test(wp)) return `"${p}" matches protected path "${glob}"`;
  }
  return null;
}

const SUPPRESSION = /@ts-(?:ignore|nocheck|expect-error)\b|eslint-disable|istanbul\s+ignore|\bnoqa\b|#\s*type:\s*ignore/;

/** Resolve symlink escapes: the nearest existing ancestor (and the file itself) must stay inside the repo. */
function symlinkViolation(repoRoot: string, workspaceRel: string, relPath: string): string | null {
  let realRepo: string;
  try {
    realRepo = fs.realpathSync(repoRoot);
  } catch {
    return null;
  }
  const abs = path.join(repoRoot, relPath);
  try {
    if (fs.lstatSync(abs).isSymbolicLink()) return `"${relPath}" is a symlink`;
  } catch {
    /* does not exist yet */
  }
  let dir = path.dirname(abs);
  while (dir.startsWith(repoRoot) && !fs.existsSync(dir)) dir = path.dirname(dir);
  try {
    const real = fs.realpathSync(dir);
    const allowedRoot = workspaceRel ? path.join(realRepo, workspaceRel) : realRepo;
    if (real !== allowedRoot && !real.startsWith(allowedRoot + path.sep)) {
      return `"${relPath}" resolves outside the workspace through a symlink`;
    }
  } catch {
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// validation entry point
// ---------------------------------------------------------------------------

/** Validate a model-proposed patch. Does NOT modify the work tree. */
export async function validatePatch(raw: string, ctx: PatchValidationContext): Promise<PatchValidation> {
  const patch = extractPatch(raw);
  if (patch.trim() === '') return { ok: false, reason: 'the provider returned an empty patch' };
  const bytes = Buffer.byteLength(patch, 'utf8');
  if (bytes > ctx.limits.maxBytes) {
    return { ok: false, reason: `patch is ${bytes} bytes; the limit is ${ctx.limits.maxBytes}` };
  }
  const headers = parseHeaders(patch);
  if (headers.problems.length > 0) {
    return { ok: false, reason: [...new Set(headers.problems)].join('; ') };
  }
  if (headers.paths.length > ctx.limits.maxFiles) {
    return { ok: false, reason: `patch touches ${headers.paths.length} files; the limit is ${ctx.limits.maxFiles}` };
  }
  for (const p of headers.paths) {
    const violation = pathViolation(p, ctx) ?? symlinkViolation(ctx.repoRoot, ctx.workspaceRel, p);
    if (violation) return { ok: false, reason: violation };
  }
  const touchedDirty = headers.paths.filter(p => ctx.dirtyPaths?.has(p));
  if (touchedDirty.length > 0) {
    return { ok: false, reason: `patch touches files with uncommitted changes: ${touchedDirty.join(', ')}` };
  }
  const suppressed = headers.addedLines.find(l => SUPPRESSION.test(l));
  if (suppressed !== undefined) {
    return {
      ok: false,
      reason: `patch adds a suppression directive (${suppressed.trim().slice(0, 80)}); fix the root cause instead`,
    };
  }
  const check = await git.applyCheck(ctx.repoRoot, patch);
  if (!check.ok) {
    return {
      ok: false,
      reason: `patch does not apply cleanly (git apply --check): ${(check.stderr || check.spawnError || '').trim().slice(0, 600)}`,
    };
  }
  const stats = await git.numstat(ctx.repoRoot, patch);
  if (!stats) return { ok: false, reason: 'could not compute the patch diffstat' };
  const additions = stats.reduce((n, s) => n + s.additions, 0);
  const deletions = stats.reduce((n, s) => n + s.deletions, 0);
  if (additions + deletions > ctx.limits.maxChangedLines) {
    return {
      ok: false,
      reason: `patch changes ${additions + deletions} lines; the limit is ${ctx.limits.maxChangedLines}`,
    };
  }
  return { ok: true, patch, files: stats, additions, deletions };
}

/**
 * package.json is editable (dependency fixes) but its test-affecting sections
 * are not: returns a reason when `scripts`, `jest`, `vitest` or `eslintConfig`
 * differ between `before` and `after` (raw file contents).
 */
export function packageJsonGuard(before: string | null, after: string | null): string | null {
  if (before === after) return null;
  const parse = (s: string | null): Record<string, unknown> | null => {
    if (s === null) return {};
    try {
      const v = JSON.parse(s);
      return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const b = parse(before);
  const a = parse(after);
  if (a === null) return 'package.json is no longer valid JSON after the patch';
  if (b === null) return null;
  for (const key of ['scripts', 'jest', 'vitest', 'eslintConfig']) {
    if (JSON.stringify(b[key] ?? null) !== JSON.stringify(a[key] ?? null)) {
      return `patch changes package.json "${key}": patches may never modify the gates`;
    }
  }
  return null;
}
