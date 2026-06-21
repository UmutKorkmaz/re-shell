import { z } from 'zod';
import {
  jsonResponseSchema,
  templateSummarySchema,
  type TemplateSummary,
} from '@re-shell/contracts';

// Re-export the canonical type so the host layer imports everything from core.
export type { TemplateSummary };

/**
 * PURE module. No VS Code, no Node side effects.
 *
 * Fetches + parses the `re-shell templates list --json` payload and projects it
 * into the grouped view model the Templates tree renders (by language, then by
 * framework). The CLI is the source of truth; this module never invents
 * templates.
 *
 * The CLI's `--json` envelope is the canonical `{ ok, data, warnings }` shape
 * from @re-shell/contracts, where `data` is `TemplateSummary[]`.
 */

const templatesEnvelopeSchema = jsonResponseSchema(z.array(templateSummarySchema));

export type ParseTemplatesResult =
  | { ok: true; templates: TemplateSummary[]; warnings: string[] }
  | { ok: false; error: string };

/**
 * Parse a raw `templates list --json` payload into a validated template list.
 * Never throws; returns a tagged result.
 */
export function parseTemplatesList(raw: unknown): ParseTemplatesResult {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return { ok: false, error: 'Empty output from `templates list --json`.' };
    }
    try {
      value = JSON.parse(trimmed);
    } catch {
      return { ok: false, error: 'Output of `templates list --json` is not valid JSON.' };
    }
  }

  const parsed = templatesEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      error: `templates.list payload does not match the contract: ${parsed.error.message}`,
    };
  }
  const envelope = parsed.data;
  if (!envelope.ok) {
    return { ok: false, error: `[${envelope.error.code}] ${envelope.error.message}` };
  }
  // Stable, diff-friendly order regardless of CLI ordering changes.
  const templates = [...envelope.data].sort((a, b) => {
    const byLang = a.language.localeCompare(b.language);
    if (byLang !== 0) return byLang;
    const byFramework = a.framework.localeCompare(b.framework);
    if (byFramework !== 0) return byFramework;
    return a.id.localeCompare(b.id);
  });
  return { ok: true, templates, warnings: envelope.warnings };
}

// ---------------------------------------------------------------------------
// Derived view models for the Templates tree
// ---------------------------------------------------------------------------

/**
 * A normalized language label for grouping (e.g. "typescript" → "TypeScript",
 * "python" → "Python"). Falls back to the raw value title-cased when unknown so
 * every language still gets a readable folder header.
 */
export function languageLabel(language: string): string {
  const known: Record<string, string> = {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    js: 'JavaScript',
    python: 'Python',
    go: 'Go',
    rust: 'Rust',
    ruby: 'Ruby',
    php: 'PHP',
    swift: 'Swift',
    elixir: 'Elixir',
    clojure: 'Clojure',
    java: 'Java',
    kotlin: 'Kotlin',
    csharp: 'C#',
    'c#': 'C#',
  };
  const key = language.toLowerCase();
  return known[key] ?? titleCase(language);
}

function titleCase(value: string): string {
  if (value.length === 0) return value;
  return value
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/**
 * A language → framework → templates grouping for the Templates tree. Each
 * language is a collapsible folder; under it, frameworks group the individual
 * templates. Sorting is alphabetical by language then framework.
 */
export interface TemplatesByLanguage {
  readonly language: string;
  readonly label: string;
  readonly frameworks: ReadonlyArray<{
    readonly framework: string;
    readonly templates: readonly TemplateSummary[];
  }>;
}

/**
 * Group a flat template list by language, then by framework. Pure projection;
 * the tree provider renders the result directly.
 */
export function groupTemplatesByLanguage(
  templates: readonly TemplateSummary[]
): TemplatesByLanguage[] {
  const byLanguage = new Map<string, Map<string, TemplateSummary[]>>();
  for (const t of templates) {
    let frameworks = byLanguage.get(t.language);
    if (!frameworks) {
      frameworks = new Map();
      byLanguage.set(t.language, frameworks);
    }
    let bucket = frameworks.get(t.framework);
    if (!bucket) {
      bucket = [];
      frameworks.set(t.framework, bucket);
    }
    bucket.push(t);
  }

  const result: TemplatesByLanguage[] = [];
  for (const language of [...byLanguage.keys()].sort((a, b) => a.localeCompare(b))) {
    const frameworks = byLanguage.get(language)!;
    result.push({
      language,
      label: languageLabel(language),
      frameworks: [...frameworks.keys()]
        .sort((a, b) => a.localeCompare(b))
        .map((framework) => ({
          framework,
          templates: [...frameworks.get(framework)!].sort((a, b) =>
            a.id.localeCompare(b.id)
          ),
        })),
    });
  }
  return result;
}
