import { getBackendTemplate } from '../templates/backend/index';
import { createBackendTemplate } from './backend-scaffold';
import {
  compareScaffoldToDisk,
  type ScaffoldCompareStatus,
  type ScaffoldFilePlan,
} from './scaffold-compare';
import type { DatabaseType } from './database';
import * as fs from 'fs-extra';

/**
 * One file a scaffold would emit.
 *
 * `action` says what the scaffold would do (`create` a new file, `overwrite` a
 * differing one, or leave an identical one `unchanged`); `status` is the same
 * fact in diff terms (`added` / `modified` / `unchanged`). For a clean dry run
 * (no existing target) every file is `create` / `added`.
 */
export interface DryRunFile {
  /** Project-relative path the file would be written to. */
  path: string;
  /** Size of the rendered file in bytes (UTF-8). */
  bytes: number;
  /** What the scaffold would do to the file. */
  action: 'create' | 'overwrite' | 'unchanged';
  /** How the scaffolded file compares to what is already on disk. */
  status: ScaffoldCompareStatus;
  /** Unified diff existing -> scaffolded; only set for `modified` files. */
  diff?: string;
}

/**
 * Full result of a dry-run scaffold computation. `files` is the exact set the
 * scaffold WOULD write; `previews` holds a short head of each file's contents
 * for terminal display. Nothing is written to the user's project.
 */
export interface DryRunResult {
  /** The template id that produced this result. */
  templateId: string;
  /** Project name used for placeholder substitution. */
  projectName: string;
  /** The exact set of files the scaffold WOULD write. */
  files: DryRunFile[];
  /** Sum of every rendered file's byte length. */
  totalBytes: number;
  /** Map of file path to a short head of its rendered contents. */
  previews: Record<string, string>;
  /** Whether `targetDir` was supplied and already exists. */
  targetExists: boolean;
  /** Per-status counts of `files`. */
  summary: { added: number; modified: number; unchanged: number };
}

/**
 * Options for a dry-run computation, mirroring the live `create` flow so
 * rendered output stays identical.
 */
export interface DryRunOptions {
  /** Project name substituted for {{projectName}}/{{name}} placeholders. */
  projectName: string;
  /** Optional database integration to fold in, mirroring `create`. */
  db?: DatabaseType;
  /** Organization name substituted for {{org}} (defaults to `re-shell`). */
  org?: string;
  /** Team name substituted for {{team}} (defaults to empty). */
  team?: string;
  /** Project description substituted for {{description}} (defaults to empty). */
  description?: string;
  /** Port number substituted for {{port}} (defaults to the template's own port). */
  port?: string;
  /** Max characters captured per-file preview (default 400). */
  previewLimit?: number;
  /**
   * Existing directory the scaffold would be written into. When it exists each
   * file is classified against it (added / modified / unchanged, with a unified
   * diff for modified files). Omit it for a clean-slate dry run.
   */
  targetDir?: string;
}

/**
 * Compute the EXACT set of files a backend-template scaffold would produce,
 * WITHOUT writing anything. The files come from the canonical materializer
 * (`createBackendTemplate`, the same one `create` writes with) and are compared
 * against `opts.targetDir` when it already exists.
 *
 * @param templateId - Id of the backend template to materialize.
 * @param opts - Dry-run options (project name, db, ports, target dir, etc.).
 * @returns The dry-run result, including per-file metadata and previews.
 * @throws if the template id is unknown.
 */
export async function computeBackendDryRun(
  templateId: string,
  opts: DryRunOptions
): Promise<DryRunResult> {
  const template = getBackendTemplate(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const rendered = await createBackendTemplate(template, {
    name: opts.projectName,
    normalizedName: opts.projectName,
    port: opts.port ?? template.port?.toString() ?? '3000',
    db: opts.db && opts.db !== 'none' ? opts.db : undefined,
    org: opts.org,
    team: opts.team,
    description: opts.description,
  });

  // A later file with the same path wins, exactly like sequential writes would.
  const byPath = new Map<string, string>();
  for (const file of rendered) byPath.set(file.path, file.content);
  const planned: ScaffoldFilePlan[] = [...byPath].map(([filePath, content]) => ({
    path: filePath,
    content,
  }));

  const targetExists = Boolean(opts.targetDir && fs.existsSync(opts.targetDir));
  // A missing target compares as all-added.
  const comparison = compareScaffoldToDisk(planned, targetExists ? (opts.targetDir as string) : null, {
    previewLimit: opts.previewLimit,
  });

  return {
    templateId,
    projectName: opts.projectName,
    files: comparison.files,
    totalBytes: comparison.totalBytes,
    previews: comparison.previews,
    targetExists,
    summary: comparison.summary,
  };
}

/**
 * True when the given id maps to a known backend template.
 *
 * @param templateId - The template id to test.
 * @returns `true` if a backend template is registered for this id.
 */
export function isBackendTemplate(templateId: string): boolean {
  return getBackendTemplate(templateId) !== undefined;
}
