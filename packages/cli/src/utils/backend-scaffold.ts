import type { BackendTemplate } from '../templates/backend/index';
import { getDatabaseConfig, type DatabaseType } from './database';

/**
 * Backend template context used for placeholder substitution when generating
 * backend service files.
 */
export interface BackendTemplateContext {
  name: string;
  normalizedName: string;
  port: string;
  db?: DatabaseType;
  org?: string;
  team?: string;
  description?: string;
}

/** One file a scaffold would write, relative to the scaffold's output directory. */
export interface ScaffoldOutputFile {
  path: string;
  content: string;
  executable?: boolean;
}

/**
 * Create files from a backend template.
 *
 * Flattens the template's nested file tree, applies placeholder substitution
 * using the provided context, and optionally merges database configuration
 * files. This is the single materializer shared by `create` (real writes) and
 * the dry-run preview, so the two can never drift.
 *
 * @param template - The backend template to generate files from.
 * @param context - Context values used for placeholder substitution and database config.
 * @returns Array of generated file objects with path, content, and optional executable flag.
 */
export async function createBackendTemplate(
  template: BackendTemplate,
  context: BackendTemplateContext
): Promise<ScaffoldOutputFile[]> {
  const files: ScaffoldOutputFile[] = [];

  // Recursively flatten nested file trees (e.g. django's 'config/': { 'settings/': { ... } }).
  function flattenFiles(entries: Record<string, unknown>, prefix: string): void {
    for (const [key, value] of Object.entries(entries)) {
      const fullPath = prefix ? `${prefix}${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        flattenFiles(value as Record<string, unknown>, fullPath.endsWith('/') ? fullPath : `${fullPath}/`);
      } else {
        const contentStr = String(value ?? '');
        files.push({
          path: fullPath,
          content: contentStr
            .replace(/\{\{projectName\}\}/g, context.name)
            .replace(/\{\{name\}\}/g, context.name)
            .replace(/\{\{normalizedName\}\}/g, context.normalizedName)
            .replace(/\{\{port\}\}/g, context.port)
            .replace(/\{\{org\}\}/g, context.org || 're-shell')
            .replace(/\{\{team\}\}/g, context.team || '')
            .replace(/\{\{description\}\}/g, context.description || ''),
        });
      }
    }
  }

  flattenFiles(template.files, '');

  // Add database configuration if specified
  if (context.db && context.db !== 'none') {
    const dbConfig = getDatabaseConfig(context.db);
    if (dbConfig) {
      for (const [filePath, content] of Object.entries(dbConfig.files)) {
        files.push({ path: filePath, content });
      }
    }
  }

  return files;
}
