// `re-shell migrate` — IO layer.
//
// Resolves a recipe's concrete target files on disk (repo root + each package
// dir), reads/parses them (YAML or JSON), and applies a recipe's transform to a
// file: read → transform → backup (`.bak`) → write. ast-grep source codemods run
// through an INJECTABLE runner so tests never require ast-grep installed and a
// missing binary degrades to `skipped` (never a hard failure).
//
// No `shell: true`: ast-grep is invoked with an argv array via execFile. Only
// the engine's pure types are imported here; nothing from contracts.

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { MigrationRecipe } from './migrate-engine';

/**
 * Runs ast-grep with the given argv in `cwd`, resolving with its stdout. The
 * default implementation shells out via execFile; tests inject a stub. A missing
 * binary (ENOENT) must propagate so the caller can map it to `skipped`.
 */
export type AstGrepRunner = (args: string[], cwd: string) => Promise<string>;

/** A target file resolved on disk: its path plus the parsed document. */
export interface ResolvedTarget {
  readonly path: string;
  readonly doc: Record<string, unknown>;
}

/** Outcome of applying a recipe to a single file. */
export type ApplyOutcome = 'applied' | 'skipped' | 'failed';

/** A discovered package paired with its absolute directory. */
export interface PackageDir {
  readonly name: string;
  readonly dir: string;
}

/** Result of an apply attempt across a recipe's targets. */
export interface ApplyResult {
  readonly outcome: ApplyOutcome;
  readonly warnings: string[];
}

/**
 * Default real ast-grep runner: argv via execFile (no shell interpolation). A
 * missing binary surfaces as an ENOENT error which the caller maps to `skipped`.
 */
export const defaultAstGrepRunner: AstGrepRunner = async (args, cwd) => {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const run = promisify(execFile);
  const { stdout } = await run('ast-grep', args, { cwd, maxBuffer: 1 << 24 });
  return stdout;
};

/** Is the value a plain object (record) and not an array/null? */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse a target file's contents to a record (YAML or JSON by extension). */
function parseDoc(filePath: string, content: string): Record<string, unknown> | null {
  const ext = path.extname(filePath).toLowerCase();
  try {
    const parsed =
      ext === '.json' ? JSON.parse(content) : yaml.load(content);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Serialise a record back to disk text matching its file extension. */
function serializeDoc(filePath: string, doc: Record<string, unknown>): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    return JSON.stringify(doc, null, 2) + '\n';
  }
  return yaml.dump(doc, { lineWidth: -1 });
}

/**
 * Resolve a recipe's candidate targets: check the repo root and every package
 * dir (in the order given) for `recipe.targetFile`, read+parse each, and return
 * those whose parsed document satisfies `recipe.matches`. Unreadable or
 * unparseable files are skipped silently here (they simply do not match).
 */
export function resolveCandidateTargets(
  recipe: MigrationRecipe,
  rootDir: string,
  packagesTopo: readonly PackageDir[]
): ResolvedTarget[] {
  const dirs = [rootDir, ...packagesTopo.map(p => p.dir)];
  // Dedup on the CANONICAL (realpath-resolved) path so a symlinked package dir
  // cannot cause the same physical file to be processed twice (which would
  // rewrite it twice and overwrite the .bak with post-transform content).
  const seen = new Set<string>();
  const resolved: ResolvedTarget[] = [];

  for (const dir of dirs) {
    const filePath = path.join(dir, recipe.targetFile);
    if (!fs.existsSync(filePath)) continue;
    let real: string;
    try {
      real = fs.realpathSync(filePath);
    } catch {
      continue;
    }
    if (seen.has(real)) continue;
    seen.add(real);
    let content: string;
    try {
      content = fs.readFileSync(real, 'utf8');
    } catch {
      continue;
    }
    const doc = parseDoc(real, content);
    if (doc === null) continue;
    if (recipe.matches(doc)) {
      resolved.push({ path: real, doc });
    }
  }

  return resolved;
}

/**
 * Write a `<file>.bak` backup from the EXACT content buffer that is about to be
 * transformed, so the backup always matches what was rewritten (no TOCTOU gap
 * from a second independent disk read). Writes via a temp file + rename so a
 * crash mid-write never leaves a half-written backup.
 */
export function backupFile(filePath: string, content: string): void {
  const tmp = `${filePath}.bak.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, `${filePath}.bak`);
}

/**
 * Apply a recipe to a single file.
 *
 *   - yaml/json/config kinds: read → transform → backup `.bak` → write.
 *   - ast-grep kind: invoke the injected runner; a missing binary (ENOENT)
 *     degrades to `skipped` with a warning rather than failing the run.
 *
 * Any other error returns `failed` with the message captured as a warning.
 */
export async function applyRecipeToFile(
  recipe: MigrationRecipe,
  filePath: string,
  runner: AstGrepRunner = defaultAstGrepRunner
): Promise<ApplyResult> {
  const warnings: string[] = [];

  if (recipe.kind === 'ast-grep') {
    return applyAstGrep(recipe, filePath, runner);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const doc = parseDoc(filePath, content);
    if (doc === null) {
      warnings.push(`could not parse ${filePath}; skipped`);
      return { outcome: 'skipped', warnings };
    }
    const transformed = recipe.transform(doc);
    // Back up the EXACT buffer we read (and transformed from), then write the
    // transform. The backup is taken before the destructive write.
    backupFile(filePath, content);
    fs.writeFileSync(filePath, serializeDoc(filePath, transformed), 'utf8');
    return { outcome: 'applied', warnings };
  } catch (error) {
    warnings.push(
      `failed applying "${recipe.id}" to ${filePath}: ${messageOf(error)}`
    );
    return { outcome: 'failed', warnings };
  }
}

/** Run an ast-grep codemod, mapping a missing binary to a `skipped` outcome. */
async function applyAstGrep(
  recipe: MigrationRecipe,
  filePath: string,
  runner: AstGrepRunner
): Promise<ApplyResult> {
  const warnings: string[] = [];
  const spec = recipe.astGrep;
  if (!spec) {
    warnings.push(`recipe "${recipe.id}" is ast-grep but has no pattern; skipped`);
    return { outcome: 'skipped', warnings };
  }
  try {
    await runner(
      [
        'run',
        '--pattern',
        spec.pattern,
        '--rewrite',
        spec.rewrite,
        '--update-all',
        filePath,
      ],
      path.dirname(filePath)
    );
    return { outcome: 'applied', warnings };
  } catch (error) {
    if (isEnoent(error)) {
      warnings.push('ast-grep not installed; source transform skipped');
      return { outcome: 'skipped', warnings };
    }
    warnings.push(
      `failed running ast-grep for "${recipe.id}" on ${filePath}: ${messageOf(error)}`
    );
    return { outcome: 'failed', warnings };
  }
}

/** True when the error is a "binary not found" (ENOENT) failure. */
function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

/** Extract a human message from an unknown thrown value. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}
