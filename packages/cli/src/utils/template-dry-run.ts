import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { getBackendTemplate, type BackendTemplate } from '../templates/backend/index';
import { getDatabaseConfig, type DatabaseType } from './database';

/**
 * One file a scaffold would emit. `action` is always `'create'` for a clean
 * dry run (the target directory does not exist yet, so nothing is overwritten).
 */
export interface DryRunFile {
  path: string;
  bytes: number;
  action: 'create';
}

/**
 * Full result of a dry-run scaffold computation. `files` is the exact set the
 * scaffold WOULD write; `previews` holds a short head of each file's contents
 * for terminal display. Nothing is written to the user's project — the work
 * happens in a throwaway tmp dir that is removed before this returns.
 */
export interface DryRunResult {
  templateId: string;
  projectName: string;
  files: DryRunFile[];
  totalBytes: number;
  previews: Record<string, string>;
}

export interface DryRunOptions {
  /** Project name substituted for {{projectName}}/{{name}} placeholders. */
  projectName: string;
  /** Optional database integration to fold in, mirroring `create`. */
  db?: DatabaseType;
  org?: string;
  team?: string;
  description?: string;
  port?: string;
  /** Max characters captured per-file preview (default 400). */
  previewLimit?: number;
}

const DEFAULT_PREVIEW_LIMIT = 400;

/**
 * Substitute the scaffold placeholders exactly as the live `create` flow does
 * (see `createBackendTemplate` in commands/create.ts). Kept in one place so the
 * dry run and the real write can never drift.
 */
function substitute(content: string, opts: DryRunOptions): string {
  return content
    .replace(/\{\{projectName\}\}/g, opts.projectName)
    .replace(/\{\{name\}\}/g, opts.projectName)
    .replace(/\{\{normalizedName\}\}/g, opts.projectName)
    .replace(/\{\{port\}\}/g, opts.port ?? '')
    .replace(/\{\{org\}\}/g, opts.org ?? 're-shell')
    .replace(/\{\{team\}\}/g, opts.team ?? '')
    .replace(/\{\{description\}\}/g, opts.description ?? '');
}

/**
 * Build the materialized file map (path -> content) for a backend template,
 * folding in an optional database config, mirroring the real scaffold.
 */
function materialize(
  template: BackendTemplate,
  opts: DryRunOptions
): Record<string, string> {
  const files: Record<string, string> = {};

  for (const [filePath, raw] of Object.entries(template.files)) {
    files[filePath] = substitute(String(raw), opts);
  }

  if (opts.db && opts.db !== 'none') {
    const dbConfig = getDatabaseConfig(opts.db);
    if (dbConfig) {
      for (const [filePath, content] of Object.entries(dbConfig.files)) {
        files[filePath] = String(content);
      }
    }
  }

  return files;
}

/**
 * Compute the EXACT set of files a backend-template scaffold would produce,
 * WITHOUT writing anything to the user's project. The canonical materializer
 * is rendered to a throwaway tmp directory, diffed (every file is a `create`
 * because the real target does not exist yet), then the tmp dir is discarded.
 *
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

  const materialized = materialize(template, opts);
  const previewLimit = opts.previewLimit ?? DEFAULT_PREVIEW_LIMIT;

  // Render to a throwaway tmp dir so the dry run exercises the real write path,
  // then discard it. The user's project is never touched.
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 're-shell-dryrun-'));
  try {
    const files: DryRunFile[] = [];
    const previews: Record<string, string> = {};
    let totalBytes = 0;

    for (const [filePath, content] of Object.entries(materialized)) {
      const scratchPath = path.join(scratch, filePath);
      await fs.ensureDir(path.dirname(scratchPath));
      await fs.writeFile(scratchPath, content);

      const bytes = Buffer.byteLength(content, 'utf8');
      totalBytes += bytes;
      files.push({ path: filePath, bytes, action: 'create' });

      const preview = content.slice(0, previewLimit);
      previews[filePath] = content.length > previewLimit ? `${preview}…` : preview;
    }

    files.sort((a, b) => a.path.localeCompare(b.path));

    return {
      templateId,
      projectName: opts.projectName,
      files,
      totalBytes,
      previews,
    };
  } finally {
    await fs.remove(scratch);
  }
}

/**
 * True when the given id maps to a known backend template.
 */
export function isBackendTemplate(templateId: string): boolean {
  return getBackendTemplate(templateId) !== undefined;
}
