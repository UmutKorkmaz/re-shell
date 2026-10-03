import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { createUnifiedDiff } from './unified-diff';

/** A file a scaffold would write: a forward-slashed path relative to the output root, plus its content. */
export interface ScaffoldFilePlan {
  path: string;
  content: string;
}

/** How a planned file compares to the same path under the real target. */
export type ScaffoldCompareStatus = 'added' | 'modified' | 'unchanged';

/** One classified file in a {@link ScaffoldComparison}. */
export interface ScaffoldFileReport {
  /** Path relative to the comparison root, forward-slashed. */
  path: string;
  /** Size of the rendered file in bytes (UTF-8). */
  bytes: number;
  /** `create` (new), `overwrite` (differs) or `unchanged` (identical). */
  action: 'create' | 'overwrite' | 'unchanged';
  /** `added` / `modified` / `unchanged` relative to what is on disk. */
  status: ScaffoldCompareStatus;
  /** Unified diff existing -> scaffolded; only set for `modified` files. */
  diff?: string;
}

/** Result of comparing a planned scaffold against an existing directory. */
export interface ScaffoldComparison {
  files: ScaffoldFileReport[];
  totalBytes: number;
  /** Map of file path to a short head of its rendered contents. */
  previews: Record<string, string>;
  summary: { added: number; modified: number; unchanged: number };
}

/** Options for {@link compareScaffoldToDisk}. */
export interface CompareScaffoldOptions {
  /** Max characters captured per-file preview (default 400). */
  previewLimit?: number;
  /** Cap on diff lines per modified file (default 120). */
  diffMaxLines?: number;
}

const DEFAULT_PREVIEW_LIMIT = 400;
const DEFAULT_DIFF_MAX_LINES = 120;

/** Directory names never walked or compared: they are tool output, not scaffold output. */
const SKIPPED_DIRS = new Set(['node_modules', '.git']);

/** Convert a native path to the forward-slashed form used in payloads. */
export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * Read every file under `root` (skipping `node_modules` and `.git`) into a map of
 * forward-slashed relative path to UTF-8 content. A missing root yields an empty map.
 *
 * @param root - Directory to read.
 * @returns The tree as a path -> content map.
 */
export function readTree(root: string): Map<string, string> {
  const tree = new Map<string, string>();
  if (!fs.existsSync(root)) return tree;

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const abs = path.join(dir, entry.name);
        tree.set(toPosix(path.relative(root, abs)), fs.readFileSync(abs, 'utf8'));
      }
    }
  };
  walk(root);
  return tree;
}

/**
 * Files in `after` that are new or whose content differs from `before`.
 *
 * @param before - Snapshot taken before a write.
 * @param after - Snapshot taken after a write.
 * @returns The touched files, sorted by path.
 */
export function touchedFiles(
  before: Map<string, string>,
  after: Map<string, string>
): ScaffoldFilePlan[] {
  const touched: ScaffoldFilePlan[] = [];
  for (const [filePath, content] of after) {
    if (!before.has(filePath) || before.get(filePath) !== content) {
      touched.push({ path: filePath, content });
    }
  }
  return touched.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Compare a planned scaffold against the same relative paths under `targetRoot`.
 * Every planned file is `added` (absent on disk), `modified` (present and
 * different, with a unified diff) or `unchanged` (identical). Nothing is written.
 *
 * @param files - The planned files (path relative to `targetRoot`).
 * @param targetRoot - The directory the scaffold would be written under, or
 *   `null` when there is nothing on disk to compare against (all files `added`).
 * @param options - Preview and diff limits.
 * @returns The classified files with totals, previews and a per-status summary.
 */
export function compareScaffoldToDisk(
  files: ScaffoldFilePlan[],
  targetRoot: string | null,
  options: CompareScaffoldOptions = {}
): ScaffoldComparison {
  const previewLimit = options.previewLimit ?? DEFAULT_PREVIEW_LIMIT;
  const diffMaxLines = options.diffMaxLines ?? DEFAULT_DIFF_MAX_LINES;

  const reports: ScaffoldFileReport[] = [];
  const previews: Record<string, string> = {};
  const summary = { added: 0, modified: 0, unchanged: 0 };
  let totalBytes = 0;

  const ordered = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of ordered) {
    const bytes = Buffer.byteLength(file.content, 'utf8');
    totalBytes += bytes;

    const abs = targetRoot === null ? null : path.join(targetRoot, file.path);
    let report: ScaffoldFileReport;
    if (abs === null || !isFile(abs)) {
      report = { path: file.path, bytes, action: 'create', status: 'added' };
      summary.added++;
    } else {
      const existing = fs.readFileSync(abs, 'utf8');
      if (existing === file.content) {
        report = { path: file.path, bytes, action: 'unchanged', status: 'unchanged' };
        summary.unchanged++;
      } else {
        report = {
          path: file.path,
          bytes,
          action: 'overwrite',
          status: 'modified',
          diff: createUnifiedDiff(existing, file.content, {
            oldLabel: `a/${file.path}`,
            newLabel: `b/${file.path}`,
            maxLines: diffMaxLines,
          }),
        };
        summary.modified++;
      }
    }
    reports.push(report);

    previews[file.path] =
      file.content.length > previewLimit ? `${file.content.slice(0, previewLimit)}…` : file.content;
  }

  return { files: reports, totalBytes, previews, summary };
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * Run `fn` with a fresh scratch directory under the OS temp dir and always remove
 * it afterwards, so a dry run can render the real scaffold without touching the
 * user's project.
 *
 * @param prefix - Name prefix for the scratch directory.
 * @param fn - Work to perform with the scratch directory path.
 * @returns Whatever `fn` returns.
 */
export async function withScratchDir<T>(
  prefix: string,
  fn: (scratch: string) => Promise<T>
): Promise<T> {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return await fn(scratch);
  } finally {
    fs.removeSync(scratch);
  }
}
