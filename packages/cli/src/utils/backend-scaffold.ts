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

const JVM_LANGUAGES = new Set(['java', 'kotlin', 'scala', 'groovy', 'clojure']);

function words(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(w => w.toLowerCase());
}

/** A lowercase identifier safe as a JVM package segment (letters/digits, never digit-first). */
function jvmSegment(value: string): string {
  const id = words(value).join('');
  return /^[a-z]/.test(id) ? id : `app${id}`;
}

/**
 * Every placeholder a backend template may use, derived from the project name.
 * Templates were written against different naming conventions
 * (`{{serviceName}}`, `{{projectNamePascal}}`, `{{packagePath}}`, ...); leaving
 * any of them unsubstituted produced code that could not compile.
 */
export function buildPlaceholderValues(
  context: BackendTemplateContext,
  language?: string
): Record<string, string> {
  const parts = words(context.normalizedName || context.name);
  const pascal = parts.map(w => w[0].toUpperCase() + w.slice(1)).join('') || 'App';
  const camel = pascal[0].toLowerCase() + pascal.slice(1);
  const snake = parts.join('_') || 'app';
  const org = context.org || 're-shell';
  const projectGroup = `com.${jvmSegment(org)}`;
  const projectPackage = `${projectGroup}.${jvmSegment(context.normalizedName || context.name)}`;
  const isJvm = language ? JVM_LANGUAGES.has(language.toLowerCase()) : false;
  return {
    projectName: context.name,
    name: context.name,
    serviceName: context.name,
    normalizedName: context.normalizedName,
    projectNamePascal: pascal,
    ProjectName: pascal,
    projectNameCamel: camel,
    projectNameSnake: snake,
    projectGroup,
    projectPackage,
    packagePath: projectPackage.replace(/\./g, '/'),
    packageName: isJvm ? projectPackage : context.normalizedName,
    port: context.port,
    PORT: context.port,
    org,
    author: org,
    team: context.team || '',
    description: context.description || '',
  };
}

/** Replace every known `{{key}}`; unknown placeholders (e.g. Helm/Go `{{end}}`) are left untouched. */
export function applyPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{([A-Za-z_]+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  );
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

  const placeholders = buildPlaceholderValues(context, template.language);

  // Recursively flatten nested file trees (e.g. django's 'config/': { 'settings/': { ... } }).
  // Placeholders are substituted in file PATHS too (e.g. 'src/main/java/{{packagePath}}/App.java').
  function flattenFiles(entries: Record<string, unknown>, prefix: string): void {
    for (const [key, value] of Object.entries(entries)) {
      const fullPath = prefix ? `${prefix}${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        flattenFiles(value as Record<string, unknown>, fullPath.endsWith('/') ? fullPath : `${fullPath}/`);
      } else {
        files.push({
          path: applyPlaceholders(fullPath, placeholders),
          content: applyPlaceholders(String(value ?? ''), placeholders),
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
